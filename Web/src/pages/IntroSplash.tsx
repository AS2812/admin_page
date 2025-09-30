import { useEffect } from "react";
import { motion } from "framer-motion";
import Brand from "../components/Brand";

const SHOW_MS = 1800;   // how long the splash stays
const FADE_MS = 500;    // fade-in duration

export default function IntroSplash({ onDone }: { onDone: () => void }) {
  // Show only once
  // if (localStorage.getItem("splashSeen") === "1") return null;

  useEffect(() => {
    const t = setTimeout(() => {
      // localStorage.setItem("splashSeen", "1");
      onDone();
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      onClick={() => { /* localStorage.setItem("splashSeen","1"); */ onDone(); }}
      role="dialog"
      aria-label="SpotnSend intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_MS / 1000, ease: "easeOut" }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        width: "100vw",
        height: "100svh",
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        backgroundImage:"linear-gradient(90deg, #01a1e7 0%, #aa4b7f 38%, #eb3e50 100%)",
        willChange: "opacity"
      }}
    >
      <motion.div 
        initial={{ scale: 0.985 }} 
        animate={{ scale: 1 }} 
        transition={{ duration: FADE_MS / 1000 }}
      >
        <Brand size={490}/>
      </motion.div>
    </motion.div>
  );
}