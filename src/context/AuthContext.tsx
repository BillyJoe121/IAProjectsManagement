import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserRole } from '../types';
import { supabaseClient } from '../services/supabaseClient';
import { SyncService } from '../services/syncService';

interface AuthContextType {
  role: UserRole;
  userEmail: string;
  userName: string;
  studentCode?: string;
  assignedProjectId: string | null;
  userId: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLocalDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  requestAdminPasswordRecovery: (email: string) => Promise<void>;
  changeAdminPassword: (password: string) => Promise<void>;
  isPasswordRecovery: boolean;
  logout: () => Promise<void>;
  switchRoleToggle: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
// The local role switch exists exclusively for automated tests. All normal
// development and deployed builds authenticate through Supabase.
const localDemoEnabled = import.meta.env.VITE_TEST_MODE === 'true';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>(localDemoEnabled ? 'superuser' : 'student_group');
  const [userEmail, setUserEmail] = useState(localDemoEnabled ? 'monitor.ia@u.icesi.edu.co' : '');
  const [userName, setUserName] = useState(localDemoEnabled ? 'Monitor Principal (Superuser)' : '');
  const [studentCode, setStudentCode] = useState<string | undefined>(localDemoEnabled ? 'SUPERUSER-001' : undefined);
  const [assignedProjectId, setAssignedProjectId] = useState<string | null>(null);
  const [userId, setUserId] = useState(localDemoEnabled ? 'monitor-demo' : '');
  const [isAuthenticated, setIsAuthenticated] = useState(localDemoEnabled);
  const [isLoading, setIsLoading] = useState(!localDemoEnabled && Boolean(supabaseClient));
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const loadUser = async (user: { id: string; email?: string | null } | null) => {
    if (!user || !supabaseClient) {
      setIsAuthenticated(false); setUserId(''); setUserEmail(''); setUserName(''); setAssignedProjectId(null); setIsLoading(false); return;
    }
    const { data: profile, error } = await supabaseClient.from('profiles').select('full_name,email,student_code,role,project_id').eq('id', user.id).single();
    if (error) console.warn('No se pudo cargar el perfil de Supabase.', error.message);
    const nextRole = profile?.role;
    setRole(nextRole === 'superuser' || nextRole === 'company_contact' ? nextRole : 'student_group');
    setUserId(user.id);
    setUserEmail(profile?.email || user.email || '');
    setUserName(profile?.full_name || user.email?.split('@')[0] || 'Usuario');
    setStudentCode(profile?.student_code || undefined);
    setAssignedProjectId(profile?.project_id || null);
    setIsAuthenticated(true); setIsLoading(false);
  };

  useEffect(() => {
    if (localDemoEnabled || !supabaseClient) { setIsLoading(false); return; }
    void supabaseClient.auth.getSession().then(({ data }) => loadUser(data.session?.user || null));
    const { data: subscription } = supabaseClient.auth.onAuthStateChange((event, session) => { setIsPasswordRecovery(event === 'PASSWORD_RECOVERY'); void loadUser(session?.user || null); });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabaseClient) throw new Error('Supabase no está configurado en este entorno.');
    const suppliedCode = password.trim();
    const normalizedPassword = /^[aA]\d+$/.test(suppliedCode) ? `A${suppliedCode.slice(1)}` : password;
    const { data, error } = await supabaseClient.functions.invoke('password-sign-in', {
      body: { email: email.trim(), password: normalizedPassword },
    });
    if (error) {
      setIsLoading(false);
      const status = (error as { context?: Response }).context?.status;
      if (status === 429 || /rate limit|too many requests|429/i.test(error.message)) {
        throw new Error('El servicio de autenticación limitó los intentos desde esta red. Espera unos minutos antes de volver a intentarlo.');
      }
      throw new Error('No fue posible iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.');
    }
    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) throw new Error('No fue posible iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.');
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (sessionError || !sessionData.user) throw new Error('No fue posible iniciar sesión. Inténtalo de nuevo.');
    await loadUser(sessionData.user);
  };
  const logout = async () => {
    if (localDemoEnabled) return;
    // Mutations are authorized with the active user's JWT. Finish the outbox
    // before replacing a student's session with a monitor's session, so a
    // pending application cannot be rejected by RLS as an impersonated write.
    await SyncService.flush();
    await supabaseClient?.auth.signOut();
    await loadUser(null);
  };
  const requestAdminPasswordRecovery = async (email: string) => {
    if (!supabaseClient) throw new Error('Supabase no está configurado en este entorno.');
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
    if (error) throw new Error(error.message);
  };
  const changeAdminPassword = async (password: string) => {
    if (role !== 'superuser') throw new Error('Solo monitor o profesor puede cambiar la contraseña.');
    if (password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
    const { error } = await supabaseClient!.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    setIsPasswordRecovery(false);
  };
  const switchRoleToggle = () => {
    if (!localDemoEnabled) return;
    if (role === 'superuser') {
      setRole('student_group'); setUserId('student-demo-a'); setUserEmail('angela6309gonzalez@gmail.com'); setUserName('Ángela González'); setStudentCode('2201001'); setAssignedProjectId('proj-1');
    } else {
      setRole('superuser'); setUserId('monitor-demo'); setUserEmail('monitor.ia@u.icesi.edu.co'); setUserName('Monitor Principal (Superuser)'); setStudentCode('SUPERUSER-001'); setAssignedProjectId(null);
    }
  };

  return <AuthContext.Provider value={{ role, userId, userEmail, userName, studentCode, assignedProjectId, isAuthenticated, isLoading, isLocalDemo: localDemoEnabled, signIn, logout, requestAdminPasswordRecovery, changeAdminPassword, isPasswordRecovery, switchRoleToggle }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
