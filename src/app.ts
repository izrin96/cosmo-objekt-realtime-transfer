import "dotenv/config";

import {
  HypersyncClient,
  Decoder,
  LogField,
  BlockField,
  Query,
} from "@envio-dev/hypersync-client";
import { fetchMetadata } from "./cosmo";
import { broadcast } from "./ws";
import { randomUUID } from "node:crypto";
import { fetchKnownAddresses } from "./lib/utils";
import { overrideColor } from "./lib/objekt";
import { connectRedis } from "./lib/redis";

const CONTRACT_ADDRESS = "0x99Bb83AE9bb0C0A6be865CaCF67760947f91Cb70";

async function main() {
  // Connect to Redis
  await connectRedis();
  console.log("Connected to Redis");

  // Create hypersync client using the mainnet hypersync endpoint
  const client = HypersyncClient.new({
    url: "https://abstract.hypersync.xyz",
  });

  const height = await client.getHeight();

  // The query to run
  const query: Query = {
    // start from tip of the chain
    fromBlock: height,
    logs: [
      {
        address: [CONTRACT_ADDRESS],
        // We want the transfers
        topics: [
          [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          ],
        ],
      },
    ],
    // Select the fields we are interested in, notice topics are selected as topic0,1,2,3
    fieldSelection: {
      log: [
        LogField.Address,
        LogField.Data,
        LogField.Topic0,
        LogField.Topic1,
        LogField.Topic2,
        LogField.Topic3,
        LogField.BlockNumber,
      ],
      block: [BlockField.Timestamp, BlockField.Number],
    },
  };

  const decoder = Decoder.fromSignatures([
    "Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ]);

  while (true) {
    const res = await client.get(query);

    if (res.data.logs.length !== 0) {
      // Create a map of block numbers to timestamps for quick lookup
      const blockTimestamps = new Map(
        res.data.blocks.map((block) => {
          return [block.number, block.timestamp];
        })
      );

      // Decode the log on a background thread so we don't block the event loop.
      // Can also use decoder.decodeLogsSync if it is more convenient.
      const decodedLogs = await decoder.decodeLogs(res.data.logs);
      const logs = decodedLogs.filter((a) => a !== null && a !== undefined);

      const addresses = logs
        .map((log) => {
          const from = log.indexed[0].val as string;
          const to = log.indexed[1].val as string;
          return [from, to];
        })
        .flatMap((a) => a);

      const metadataBatch = await Promise.allSettled(
        logs.map((log) => {
          const tokenId = log.indexed[2].val as bigint;
          return fetchMetadata(tokenId.toString());
        })
      );

      const knownAddresses = await fetchKnownAddresses(addresses);

      const transferEvents = [];

      for (let i = 0; i < logs.length; i++) {
        const metadataResult = metadataBatch[i];

        if (metadataResult.status !== "fulfilled") {
          continue;
        }

        const log = logs[i];
        const metadata = metadataResult.value;

        const from = log.indexed[0].val as string;
        const to = log.indexed[1].val as string;
        const tokenId = log.indexed[2].val as bigint;
        const blockNumber = res.data.logs[i].blockNumber;

        const timestamp = blockTimestamps.get(blockNumber);
        const blockTimestamp = new Date(Number(timestamp) * 1000);

        console.log(`Token ${tokenId} from ${from} to ${to}`);

        const fromUser = knownAddresses.find(
          (a) => a.address.toLowerCase() === from.toLowerCase()
        );
        const toUser = knownAddresses.find(
          (a) => a.address.toLowerCase() === to.toLowerCase()
        );

        if (fromUser?.hideActivity === true || toUser?.hideActivity === true)
          continue;

        const slug = metadata.objekt.collectionId
          .toLowerCase()
          // replace diacritics
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          // remove non-alphanumeric characters
          .replace(/[^\w\s-]/g, "")
          // replace spaces with hyphens
          .replace(/\s+/g, "-");

        const transferEvent = {
          user: {
            from: fromUser
              ? { nickname: fromUser.nickname, address: fromUser.address }
              : undefined,
            to: toUser
              ? { nickname: toUser.nickname, address: toUser.address }
              : undefined,
          },
          transfer: {
            id: randomUUID(),
            from,
            to,
            timestamp: blockTimestamp,
            tokenId: tokenId.toString(),
          },
          objekt: {
            artist: metadata.objekt.artists[0].toLowerCase(),
            backImage: metadata.objekt.backImage,
            class: metadata.objekt.class,
            collectionId: metadata.objekt.collectionId,
            collectionNo: metadata.objekt.collectionNo,
            frontImage: metadata.objekt.frontImage,
            id: tokenId.toString(),
            member: metadata.objekt.member,
            onOffline: metadata.objekt.collectionNo.includes("Z")
              ? "online"
              : "offline",
            receivedAt: blockTimestamp,
            season: metadata.objekt.season,
            serial: metadata.objekt.objektNo,
            slug: slug,
            transferable: metadata.objekt.transferable,
            ...overrideColor({
              slug,
              backgroundColor: metadata.objekt.backgroundColor,
              textColor: metadata.objekt.textColor,
            }),
          },
        };

        transferEvents.push(transferEvent);
      }

      // Broadcast all transfer events together if there are any
      if (transferEvents.length > 0) {
        // broadcast in descending order
        transferEvents.reverse();
        broadcast({
          type: "transfer",
          data: transferEvents,
        });
      }
    }

    let height = res.archiveHeight;
    while (height! < res.nextBlock) {
      // wait if we are at the head
      //   console.log(`waiting for chain to advance. Height is ${height}`);
      height = await client.getHeight();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Continue query from nextBlock
    query.fromBlock = res.nextBlock;
  }
}

main();
