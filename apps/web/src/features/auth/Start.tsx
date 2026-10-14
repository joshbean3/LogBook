import { motion, useReducedMotion } from 'motion/react';
import { Link, Navigate, useNavigate } from 'react-router';
import { fadeIn, springs } from '@/lib/motion';
import { LogoMark } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useAuthStatus } from './AuthScreens';
import './auth.css';

/**
 * The first screen a new person sees (experience §5.8 step 1, critic B7): black, the mark, the halo rising once,
 * "Your day, lit.", **Start** (the account, then three questions) and a quiet "I have an account".
 * Value before the ask: nothing here asks for anything.
 */
export const Start = () => {
  const reduce = useReducedMotion();
  const nav = useNavigate();
  const status = useAuthStatus();
  // a server that takes no new accounts: there is nothing to start, only to sign in
  if (status.data && !(status.data.signupOpen ?? status.data.setupOpen)) return <Navigate to="/login" replace />;
  return (
    <main className="start">
      <span className="auth-halo rise" aria-hidden="true" />
      <div className="start-stage">
        <div className="start-step">
          <motion.div className="start-mark" initial={reduce ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={reduce ? fadeIn : { ...springs.page, delay: 0.15 }}>
            <LogoMark size={56} color="#fff" />
          </motion.div>
          <motion.h1 className="start-title display" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? fadeIn : { ...springs.page, delay: 0.45 }}>
            Your day, lit.
          </motion.h1>
          <motion.p className="start-sub" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12, delay: reduce ? 0 : 0.7 }}>
            A plan that fits your mornings. Three questions, then your first week.
          </motion.p>
          <div className="start-foot">
            <Pressable className="btn primary block start-cta" onPress={() => nav('/signup')}>
              Start
            </Pressable>
            <Link to="/login" className="start-signin">
              I have an account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};
