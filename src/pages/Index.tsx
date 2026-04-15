import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import PortfolioSection from "@/components/PortfolioSection";
import ServicesSection from "@/components/ServicesSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

const Index = () => (
  <main className="bg-background">
    <Navbar />
    <HeroSection />
    <PortfolioSection />
    <ServicesSection />
    <AboutSection />
    <ContactSection />
    <Footer />
  </main>
);

export default Index;
