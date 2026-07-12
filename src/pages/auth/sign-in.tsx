import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Eye, EyeOff, Loader2, User, Lock } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type SignInForm = z.infer<typeof signInSchema>

export default function SignIn() {
  const t = useT()
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const form = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignInForm) {
    const { error } = await signIn(values.email, values.password)
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message })
      return
    }
    navigate('/dashboard', { replace: true })
  }

  async function handleGenerateCode() {
    if (!recoveryEmail) return
    setIsGenerating(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
      const res = await fetch(`${supabaseUrl}/functions/v1/recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ action: 'send_code', email: recoveryEmail }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast({ variant: 'destructive', title: 'Erreur', description: data.error || 'Erreur inattendue' })
        return
      }
      setGeneratedCode(data.newCode || '')
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer le code' })
    } finally {
      setIsGenerating(false)
    }
  }

  function openRecoveryDialog() {
    setRecoveryEmail(form.getValues('email'))
    setGeneratedCode('')
    setRecoveryDialogOpen(true)
  }

  return (
    <div className="h-screen flex relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      <div className="absolute inset-0 bg-black/40" />

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10">
        <div className="flex flex-col justify-center w-full px-16 h-screen">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 mt-16"
          >
            <img src="/QLG_3D-removebg-preview.png" alt="QLF GYM" className="h-32 w-auto drop-shadow-lg" />
          </motion.div>

          {/* Welcome */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm font-semibold tracking-[0.15em] uppercase text-[#054AC2] mb-4"
          >
            BIENVENUE SUR FITMANAGER PRO
          </motion.p>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="text-5xl font-bold leading-[1.1] text-white mb-5"
          >
            GÉREZ VOTRE SALLE<br />
            <span className="text-[#054AC2]">EN TOUTE SIMPLICITÉ</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-base text-white max-w-lg leading-relaxed mb-10"
          >
            Une plateforme moderne et complète pour gérer vos adhérents, vos abonnements, vos ventes et suivre vos statistiques en temps réel.
          </motion.p>

          {/* Features grid */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="grid grid-cols-3 gap-x-8 gap-y-6 mb-12"
          >
            {[
              { icon: "📊", title: "STATISTIQUES" },
              { icon: "👥", title: "ADHÉRENTS" },
              { icon: "💳", title: "ABONNEMENTS" },
              { icon: "🛒", title: "POINT DE VENTE" },
              { icon: "📅", title: "PLANNING" },
              { icon: "🔒", title: "ACCÈS RFID" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-[#054AC2]/15 border border-[#054AC2]/20 flex items-center justify-center">
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <span className="text-xs font-semibold text-white/80 tracking-wider text-center">{item.title}</span>
              </div>
            ))}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <div className="w-48 h-px bg-white/10 mb-4" />
            <p className="text-sm font-semibold tracking-[0.2em] text-white/50">
              SIMPLE • RAPIDE • SÉCURISÉ
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-6">
            <img src="/QLG_3D-removebg-preview.png" alt="QLF GYM" className="h-12 w-auto drop-shadow-lg" />
          </div>

          {/* Form card */}
          <div className="bg-[#0a0f1a]/90 backdrop-blur-xl border border-[#054AC2]/30 rounded-2xl p-8 shadow-2xl shadow-[#054AC2]/10">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <img src="/LOGO QLForiginal.png" alt="FitManager" className="h-28 w-auto drop-shadow-xl" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white text-center mb-1">BIENVENUE</h2>
            <p className="text-sm text-white/50 text-center mb-6">Connectez-vous pour accéder à votre espace</p>

            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-white/60 uppercase tracking-wider">Email ou identifiant</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <Input
                            type="email"
                            placeholder="you@exemple.com"
                            className="h-11 pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#054AC2] focus:ring-[#054AC2]/30"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-white/60 uppercase tracking-wider">Mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="h-11 pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#054AC2] focus:ring-[#054AC2]/30"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-11 bg-[#054AC2] hover:bg-[#043da8] text-white font-semibold text-sm mt-2"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  CONNEXION
                </Button>
              </form>
            </Form>

            {/* Links */}
            <div className="mt-5 text-center text-sm text-white/50 space-y-2">
              <p>
                Mot de passe oublié ?{' '}
                <Link to="/auth/recovery" className="text-[#054AC2] hover:text-[#054AC2]/80 font-semibold">
                  Réinitialiser
                </Link>
              </p>
              <p>
                <button
                  type="button"
                  onClick={openRecoveryDialog}
                  className="text-[#054AC2] hover:text-[#054AC2]/80 font-semibold"
                >
                  Obtenir mon code de récupération
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recovery code dialog */}
      <Dialog open={recoveryDialogOpen} onOpenChange={setRecoveryDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0a0f1a] border border-[#054AC2]/30 text-white">
          <DialogHeader>
            <DialogTitle>Code de récupération</DialogTitle>
            <DialogDescription className="text-white/50">
              Entrez votre email pour obtenir un code de récupération. L'ancien code sera invalidé.
            </DialogDescription>
          </DialogHeader>

          {!generatedCode ? (
            <div className="space-y-4 py-2">
              <Input
                type="email"
                placeholder="votre@email.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#054AC2] focus:ring-[#054AC2]/30"
              />
              <Button
                onClick={handleGenerateCode}
                disabled={isGenerating || !recoveryEmail}
                className="w-full h-11 bg-[#054AC2] hover:bg-[#043da8] text-white"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Générer mon code
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="bg-white/5 border border-[#054AC2]/20 rounded-lg p-4">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 text-center">
                  Votre code de récupération
                </p>
                <p className="text-2xl font-mono font-bold text-center text-[#054AC2] tracking-widest">
                  {generatedCode}
                </p>
              </div>
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <p className="text-xs text-warning text-center">
                  ⚠️ Sauvegardez ce code dans un endroit sûr.{'\n'}
                  Il ne sera plus jamais affiché. Vous en aurez besoin pour réinitialiser votre mot de passe si vous l'oubliez.
                </p>
              </div>
              <Button
                onClick={() => setRecoveryDialogOpen(false)}
                className="w-full h-11 bg-[#054AC2] hover:bg-[#043da8] text-white"
              >
                J'ai sauvegardé mon code
              </Button>
            </div>
          )}

          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="ghost" onClick={() => setRecoveryDialogOpen(false)} className="text-white/50 hover:text-white">
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
