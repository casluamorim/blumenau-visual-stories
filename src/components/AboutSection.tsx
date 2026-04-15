import { motion } from "framer-motion";

const stats = [
  { value: "150+", label: "Projetos Entregues" },
  { value: "8", label: "Anos de Experiência" },
  { value: "50+", label: "Clientes Ativos" },
];

const AboutSection = () => {
  return (
    <section id="about" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-body text-sm uppercase tracking-[0.3em] text-primary mb-2">Quem somos</p>
            <h2 className="font-display text-5xl md:text-7xl text-foreground mb-8">SOBRE NÓS</h2>
            <div className="space-y-4 text-muted-foreground font-body leading-relaxed">
              <p>
                Somos uma produtora audiovisual baseada em Blumenau, no coração do Vale do Itajaí. 
                Nossa paixão é transformar momentos em narrativas visuais que emocionam e conectam.
              </p>
              <p>
                Com equipamentos de última geração e um time criativo apaixonado, entregamos produções 
                que combinam técnica impecável com sensibilidade artística — seja em um filme institucional, 
                um casamento ou uma campanha publicitária.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-3 gap-4"
          >
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="text-center p-6 border border-border hover:border-primary/30 transition-colors duration-300"
              >
                <p className="font-display text-4xl md:text-5xl text-primary">{stat.value}</p>
                <p className="font-body text-xs uppercase tracking-wider text-muted-foreground mt-2">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
