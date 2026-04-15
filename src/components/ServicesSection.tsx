import { motion } from "framer-motion";
import { Camera, Video, Plane, Film } from "lucide-react";

const services = [
  {
    icon: Video,
    title: "PRODUÇÃO DE VÍDEO",
    description: "Filmes institucionais, documentários, videoclipes e conteúdo para redes sociais com qualidade cinematográfica.",
  },
  {
    icon: Camera,
    title: "FOTOGRAFIA",
    description: "Ensaios, eventos, fotografia corporativa e editorial com direção de arte e pós-produção premium.",
  },
  {
    icon: Plane,
    title: "IMAGENS AÉREAS",
    description: "Captação com drones profissionais para vistas aéreas impactantes e perspectivas únicas.",
  },
  {
    icon: Film,
    title: "PÓS-PRODUÇÃO",
    description: "Edição, color grading, motion graphics e finalização com os mais altos padrões do mercado.",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="font-body text-sm uppercase tracking-[0.3em] text-primary mb-2">O que fazemos</p>
          <h2 className="font-display text-5xl md:text-7xl text-foreground">SERVIÇOS</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-secondary p-10 group hover:bg-card transition-colors duration-500"
            >
              <service.icon className="w-8 h-8 text-primary mb-6 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="font-display text-2xl text-foreground mb-3">{service.title}</h3>
              <p className="font-body text-muted-foreground leading-relaxed">{service.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
