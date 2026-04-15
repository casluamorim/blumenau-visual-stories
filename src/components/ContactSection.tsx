import { motion } from "framer-motion";
import { MapPin, Mail, Phone, Instagram } from "lucide-react";

const ContactSection = () => {
  return (
    <section id="contact" className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="font-body text-sm uppercase tracking-[0.3em] text-primary mb-2">Vamos conversar</p>
          <h2 className="font-display text-5xl md:text-7xl text-foreground">CONTATO</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {[
              { icon: MapPin, text: "Blumenau, SC" },
              { icon: Mail, text: "contato@lumiere.com.br" },
              { icon: Phone, text: "(47) 99999-0000" },
              { icon: Instagram, text: "@lumiere.producoes" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-4 p-4 border border-border hover:border-primary/30 transition-colors duration-300">
                <item.icon className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="font-body text-sm text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </div>

          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nome"
                className="bg-background border border-border p-4 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
              />
              <input
                type="email"
                placeholder="E-mail"
                className="bg-background border border-border p-4 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <textarea
              rows={4}
              placeholder="Conte-nos sobre seu projeto..."
              className="w-full bg-background border border-border p-4 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors resize-none"
            />
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground font-display text-lg tracking-wider py-4 hover:opacity-90 transition-opacity duration-300"
            >
              ENVIAR MENSAGEM
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;
