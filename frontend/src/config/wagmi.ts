"use client";

import { http, createConfig } from "wagmi";
import { arcTestnet } from "viem/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected({
      target: "metaMask",
    }),
  ],
  transports: {
    [arcTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
