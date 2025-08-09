'use client';
import { motion } from "framer-motion";
export default function Section({title, children}:{title:string; children:React.ReactNode}){
  return (
    <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.2}} className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-xl bg-gray-100">🔧</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}
