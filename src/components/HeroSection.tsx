import { motion } from "framer-motion";
import heroImage from "@/assets/hero-blumenau.jpg";

const HeroSection = () => {
  return (
    <section id="hero" className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Vista aérea cinematográfica de Blumenau"
          className="w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-background/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto h-full flex flex-col justify-end pb-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <p className="font-body text-sm uppercase tracking-[0.3em] text-primary mb-4">
            Produtora Audiovisual — Blumenau, SC
          </p>
          <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-[0.85] text-foreground">
            CONTAMOS
            <br />
            <span className="text-gradient">HISTÓRIAS</span>
            <br />
            EM IMAGENS
          </h1>
          <p className="font-body text-muted-foreground text-lg md:text-xl max-w-lg mt-6">
            Fotografia e vídeo que capturam a essência de cada momento com um olhar cinematográfico único.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-px h-12 bg-primary/50 animate-pulse" />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
