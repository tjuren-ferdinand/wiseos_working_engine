"use client";

import { motion } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const wPath = "M 40 60 L 70 120 L 100 80 L 130 120 L 160 70";

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      initial={{ backgroundColor: "#1E1E1E", opacity: 1 }}
      animate={{ backgroundColor: "#FBFBFC", opacity: 0 }}
      transition={{
        backgroundColor: { delay: 1.3, duration: 0.5, ease: "easeInOut" },
        opacity: { delay: 1.8, duration: 0.4, ease: "easeInOut" },
      }}
      onAnimationComplete={onComplete}
    >
      <svg
        viewBox="0 0 200 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="WiseOS"
        style={{
          width: "min(45vmin, 240px)",
          height: "auto",
          filter: "drop-shadow(0 0 18px rgba(255, 255, 255, 0.35))",
          overflow: "visible",
        }}
      >
        {/* Glass fill body */}
        <motion.path
          d={wPath}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            pathLength: 1,
            opacity: 0,
            stroke: "rgba(253, 253, 253, 0.12)",
            strokeWidth: 20,
          }}
          animate={{
            opacity: 1,
            stroke: "rgba(54, 69, 79, 0.12)",
          }}
          transition={{
            opacity: { delay: 0.8, duration: 0.5, ease: "easeOut" },
            stroke: { delay: 1.3, duration: 0.5, ease: "easeInOut" },
          }}
        />

        {/* Glowing white contour */}
        <motion.path
          d={wPath}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{
            pathLength: 0,
            stroke: "#FDFDFD",
            strokeWidth: 4,
          }}
          animate={{
            pathLength: 1,
            stroke: "#36454F",
          }}
          transition={{
            pathLength: { duration: 0.8, ease: "easeInOut" },
            stroke: { delay: 1.3, duration: 0.5, ease: "easeInOut" },
          }}
        />

        {/* Dot */}
        <motion.circle
          cx="155"
          cy="45"
          r="9"
          initial={{ scale: 0, opacity: 0, fill: "#FDFDFD" }}
          animate={{ scale: 1, opacity: 1, fill: "#36454F" }}
          transition={{
            scale: { delay: 0.5, duration: 0.35, ease: "backOut" },
            opacity: { delay: 0.5, duration: 0.25, ease: "easeOut" },
            fill: { delay: 1.3, duration: 0.5, ease: "easeInOut" },
          }}
        />
      </svg>

      <motion.h1
        className="mt-6 text-2xl font-semibold tracking-tight"
        initial={{ opacity: 0, y: 10, color: "rgba(255, 255, 255, 0.9)" }}
        animate={{ opacity: 1, y: 0, color: "#36454F" }}
        transition={{
          opacity: { delay: 0.9, duration: 0.4, ease: "easeOut" },
          y: { delay: 0.9, duration: 0.4, ease: "easeOut" },
          color: { delay: 1.3, duration: 0.5, ease: "easeInOut" },
        }}
      >
        WiseOS
      </motion.h1>
    </motion.div>
  );
}
