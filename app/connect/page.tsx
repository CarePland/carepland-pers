import type { Metadata } from "next";
import { CarePlandConnectWebsite } from "../components/connect/CarePlandConnectWebsite";

export const metadata: Metadata = {
  title: "CarePland Connect | When every backup fails",
  description:
    "CarePland Connect helps trusted caregivers start live conversations when every ordinary contact plan still fails.",
};

export const dynamic = "force-dynamic";

export default function CarePlandConnectPage() {
  return <CarePlandConnectWebsite />;
}
