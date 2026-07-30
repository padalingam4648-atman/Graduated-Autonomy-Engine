import { motion } from "framer-motion";
import { ArrowRight, Shield, Activity, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      
      {/* Background Concentric Circles mimicking the image */}
      <div className="landing-bg">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
          className="landing-bg-circle-1" 
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          className="landing-bg-circle-2"
        />
        <motion.div 
          animate={{ scale: [1, 1.05, 1], opacity: [0.6, 0.8, 0.6] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="landing-bg-circle-3"
        />
      </div>

      {/* Header Navigation */}
      <header className="landing-header">
        <div className="landing-logo">
          Au<span className="landing-logo-accent">tonomy</span>
        </div>
        
        <nav className="landing-nav">
          <span onClick={() => navigate("/dashboard")} className="landing-nav-link">Dashboard</span>
          <span onClick={() => navigate("/query")} className="landing-nav-link">Query Writer</span>
          <span onClick={() => navigate("/audit")} className="landing-nav-link">Audit Logs</span>
          <span onClick={() => navigate("/settings")} className="landing-nav-link">Settings</span>
        </nav>

        <button onClick={() => navigate("/query")} className="landing-start-btn">
          Start <ArrowRight size={14} />
        </button>
      </header>

      {/* Hero Content */}
      <main className="landing-main">
        
        {/* Floating Icons */}
        <motion.div 
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="landing-floating-icon landing-floating-icon-1"
        >
          <Shield size={32} className="landing-logo-accent" strokeWidth={1.5} />
        </motion.div>

        <motion.div 
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="landing-floating-icon landing-floating-icon-2"
        >
          <Activity size={32} className="landing-logo-accent" strokeWidth={1.5} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="landing-title">
            Intelligent decisions,<br />
            secure execution,<br />
            complete audit
          </h1>
          
          <p className="landing-subtitle">
            We help businesses perform natural language database operations with AI-driven risk analysis and graduated autonomy.
          </p>

          <div className="landing-button-group justify-center">
            <button 
              onClick={() => navigate("/query")} 
              className="landing-btn-primary"
            >
              Get a consultation
            </button>
            <button 
              onClick={() => navigate("/dashboard")} 
              className="landing-btn-icon"
            >
              <ArrowUpRight size={24} />
            </button>
          </div>
        </motion.div>
      </main>

    </div>
  );
}
