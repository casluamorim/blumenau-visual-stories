import { motion } from "framer-motion";
import portfolioVideo from "@/assets/portfolio-video.jpg";
import portfolioPhoto from "@/assets/portfolio-photo.jpg";
import portfolioWedding from "@/assets/portfolio-wedding.jpg";
import portfolioCorporate from "@/assets/portfolio-corporate.jpg";
import portfolioAerial from "@/assets/portfolio-aerial.jpg";

const projects = [
  { image: portfolioVideo, title: "Documentário Regional", category: "Vídeo", tall: true },
  { image: portfolioWedding, title: "Casamento no Vale", category: "Fotografia", tall: false },
  { image: portfolioCorporate, title: "Evento Corporativo", category: "Vídeo", tall: false },
  { image: portfolioPhoto, title: "Ensaio Autoral", category: "Fotografia", tall: true },
  { image: portfolioAerial, title: "Blumenau Aérea", category: "Drone", tall: false },
];

const PortfolioSection = () => {
  return (
    <section id="portfolio" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="font-body text-sm uppercase tracking-[0.3em] text-primary mb-2">Nosso trabalho</p>
          <h2 className="font-display text-5xl md:text-7xl text-foreground">PORTFÓLIO</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`group relative overflow-hidden cursor-pointer ${
                project.tall ? "md:row-span-2" : ""
              }`}
            >
              <div className={`relative overflow-hidden ${project.tall ? "h-[500px] md:h-full" : "h-[300px]"}`}>
                <img
                  src={project.image}
                  alt={project.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-background/0 group-hover:bg-background/60 transition-all duration-500" />
                <div className="absolute inset-0 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <p className="font-body text-xs uppercase tracking-[0.2em] text-primary">{project.category}</p>
                  <h3 className="font-display text-2xl text-foreground">{project.title}</h3>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PortfolioSection;
