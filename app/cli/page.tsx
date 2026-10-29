import type { Metadata } from "next";
import CliGuide from "@/components/CliGuide";

export const metadata: Metadata = { title: "CLI" };

export default function CliPage() {
  return (
    <>
      <section className="wrap page-head">
        <p className="eyebrow">CLI</p>
        <h1 className="page-title">Fixr on your computer.</h1>
        <p className="page-lede">
          The same scanners, filter and explanations, run from a terminal on your own machine: nothing leaves your computer
          except the explanations. About five minutes to set up, once. After that, scanning is one command.
        </p>
      </section>
      <section className="wrap cli-page">
        <CliGuide />
      </section>
    </>
  );
}
