/* eslint-disable @typescript-eslint/no-var-requires */
// Import the API
const { ApiPromise,WsProvider } = require('@polkadot/api');
const lodash_1 = require("lodash");

// import {
//     BlockHash,
//     EventRecord,
//     LastRuntimeUpgradeInfo,
//     RuntimeVersion,
//     SignedBlock,
//   } from '@polkadot/types/interfaces';

async function getBlockByHeight(api, height) {
  const blockHash = await api.rpc.chain.getBlockHash(height).catch((e) => {
      console.log(`failed to fetch BlockHash ${height}`);
      throw e;
  });
  return api.rpc.chain.getBlock(blockHash).catch((e) => {
      console.log(`failed to fetch Block ${blockHash}`);
      throw e;
  });
}

async function fetchBlocksRange(api, startHeight, endHeight) {
  return Promise.all((0, lodash_1.range)(startHeight, endHeight + 1).map(async (height) => getBlockByHeight(api, height)));
}

async function fetchEventsRange(api, hashs) {
  return Promise.all(hashs.map((hash) => api.query.system.events.at(hash).catch((e) => {
      console.log(`failed to fetch events at block ${hash}`);
      throw e;
  })));
}

async function fetchRuntimeVersionRange(api, hashs) {
  return Promise.all(hashs.map((hash) => api.rpc.state.getRuntimeVersion(hash).catch((e) => {
      console.log(`failed to fetch RuntimeVersion at block ${hash}`);
      throw e;
  })));
}

async function fetchBlocksBatches(api, blockArray, overallSpecVer) {
  const blocks = await fetchBlocksArray(api, blockArray);
  const blockHashs = blocks.map((b) => b.block.header.hash);
  const parentBlockHashs = blocks.map((b) => b.block.header.parentHash);
  // If overallSpecVersion passed, we don't need to use api to get runtimeVersions
  // wrap block with specVersion
  // If specVersion changed, we also not guarantee in this batch contains multiple runtimes,
  // therefore we better to fetch runtime over all blocks
  const [blockEvents, runtimeVersions] = await Promise.all([
      fetchEventsRange(api, blockHashs),
      overallSpecVer !== undefined // note, we need to be careful if spec version is 0
          ? undefined
          : fetchRuntimeVersionRange(api, parentBlockHashs),
  ]);
  return blocks.map((block, idx) => {
      const events = blockEvents[idx];
      const parentSpecVersion = overallSpecVer !== undefined
          ? overallSpecVer
          : runtimeVersions[idx].specVersion.toNumber();
      const wrappedBlock = wrapBlock(block, events.toArray(), parentSpecVersion);
      const wrappedExtrinsics = wrapExtrinsics(wrappedBlock, events);
      const wrappedEvents = wrapEvents(wrappedExtrinsics, events, wrappedBlock);
      return {
          block: wrappedBlock,
          extrinsics: wrappedExtrinsics,
          events: wrappedEvents,
      };
  });
}

async function fetchBlocksArray(api, blockArray) {
  return Promise.all(blockArray.map(async (height) => getBlockByHeight(api, height)));
}

function wrapBlock(signedBlock, events, specVersion) {
  return (0, lodash_1.merge)(signedBlock, {
      timestamp: getTimestamp(signedBlock),
      specVersion: specVersion,
      events,
  });
}

function getTimestamp({ block: { extrinsics } }) {
  for (const e of extrinsics) {
      const { method: { method, section }, } = e;
      if (section === 'timestamp' && method === 'set') {
          const date = new Date(e.args[0].toJSON());
          if (isNaN(date.getTime())) {
              throw new Error('timestamp args type wrong');
          }
          return date;
      }
  }
}

function wrapExtrinsics(wrappedBlock, allEvents) {
  return wrappedBlock.block.extrinsics.map((extrinsic, idx) => {
      const events = filterExtrinsicEvents(idx, allEvents);
      return {
          idx,
          extrinsic,
          block: wrappedBlock,
          events,
          success: getExtrinsicSuccess(events),
      };
  });
}

function filterExtrinsicEvents(extrinsicIdx, events) {
  return events.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eqn(extrinsicIdx));
}

function getExtrinsicSuccess(events) {
  return (events.findIndex((evt) => evt.event.method === 'ExtrinsicSuccess') > -1);
}

function wrapEvents(extrinsics, events, block) {
  return events.reduce((acc, event, idx) => {
      const { phase } = event;
      const wrappedEvent = (0, lodash_1.merge)(event, { idx, block });
      if (phase.isApplyExtrinsic) {
          wrappedEvent.extrinsic = extrinsics[phase.asApplyExtrinsic.toNumber()];
      }
      acc.push(wrappedEvent);
      return acc;
  }, []);
}

async function main () {
  const wsProvider = new WsProvider('wss://rpc.polkadot.io');
  const api = await ApiPromise.create({ provider: wsProvider });;

  const res = await fetchBlocksBatches(api, (0, lodash_1.range)(1, 2 + 1))

  console.log(res.toString())

  res.forEach(element => {
    console.log(element)
  });
}

main().catch(console.error);
