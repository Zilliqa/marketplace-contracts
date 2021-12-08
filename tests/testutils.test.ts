import { extractTypes, getJSONValue } from "./testutil";

describe("extractTypes", () => {
  const testCases = [
    {
      type: "Pair (ByStr20) (Uint256)",
      want: ["ByStr20", "Uint256"],
    },
    {
      type: "Pair (List (ByStr20)) (Uint256)",
      want: ["List (ByStr20)", "Uint256"],
    },
    {
      type: "List (Pair (ByStr20) (Uint256))",
      want: ["Pair (ByStr20) (Uint256)"],
    },
  ];

  for (const testCase of testCases) {
    const { type, want } = testCase;
    it(type, () => {
      const res = extractTypes(type);
      expect(JSON.stringify(res)).toBe(JSON.stringify(want));
    });
  }
});

describe("getJSONValue", () => {
  const testCases = [
    {
      type: "String",
      value: "Test",
      want: "Test",
    },
    {
      type: "Uint256",
      value: 1,
      want: "1",
    },
    {
      type: "ByStr20",
      value: "0x0000000000000000000000000000000000000ABC",
      want: "0x0000000000000000000000000000000000000abc",
    },
    {
      type: "Bool",
      value: false,
      want: { argtypes: [], arguments: [], constructor: "False" },
    },
    {
      type: "Bool",
      value: true,
      want: { argtypes: [], arguments: [], constructor: "True" },
    },
    {
      type: "Pair (ByStr20) (Uint256)",
      value: ["0x0000000000000000000000000000000000000000", 1],
      want: {
        argtypes: ["ByStr20", "Uint256"],
        arguments: ["0x0000000000000000000000000000000000000000", "1"],
        constructor: "Pair",
      },
    },
    {
      type: "Pair (List (ByStr20)) (Uint256)",
      value: [
        [
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000001",
        ],
        1,
      ],
      want: {
        argtypes: ["List (ByStr20)", "Uint256"],
        arguments: [
          [
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000001",
          ],
          "1",
        ],
        constructor: "Pair",
      },
    },
    {
      type: "List (ByStr20)",
      value: [
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000001",
      ],
      want: [
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000001",
      ],
    },
    {
      type: "List (Pair (ByStr20) (Uint256))",
      value: [
        ["0x0000000000000000000000000000000000000000", 1],
        ["0x0000000000000000000000000000000000000001", 2],
      ],
      want: [
        {
          argtypes: ["ByStr20", "Uint256"],
          arguments: ["0x0000000000000000000000000000000000000000", "1"],
          constructor: "Pair",
        },
        {
          argtypes: ["ByStr20", "Uint256"],
          arguments: ["0x0000000000000000000000000000000000000001", "2"],
          constructor: "Pair",
        },
      ],
    },
  ];

  for (const testCase of testCases) {
    const { value, type, want } = testCase;
    it(type, () => {
      const res = getJSONValue(value, type);
      expect(JSON.stringify(res)).toBe(JSON.stringify(want));
    });
  }
});
