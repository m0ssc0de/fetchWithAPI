# types

## SignedBlock

```json
{
  "block": {
    "header": {
      "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "number": 0,
      "stateRoot": "0x29d0d972cd27cbc511e9589fcb7a4506d5eb6a9e8df205f00472e5ab354a4e17",
      "extrinsicsRoot": "0x03170a2e7597b7b7e3d84c05391d139a62b157e78786d8c082f29dcf4c111314",
      "digest": {
        "logs": []
      }
    },
    "extrinsics": []
  },
  "justifications": null
}
```

```js
export interface SubstrateBlock extends SignedBlock {
  // parent block's spec version, can be used to decide the correct metadata that should be used for this block.
  specVersion: number;
  timestamp: Date;
  events: EventRecord[];
}
```