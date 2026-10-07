import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { WhyInterviewAI } from "@/components/landing/why-interviewai";
import { FinalCTA } from "@/components/landing/final-cta";

export default function Home() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Features />
        <HowItWorks />
        <DashboardPreview />
        <WhyInterviewAI />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
