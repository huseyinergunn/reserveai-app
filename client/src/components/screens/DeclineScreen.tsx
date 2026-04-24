import { useAppointmentForm } from '../../hooks/useAppointmentForm';
import { Button } from '../ui/Button';
import { MessageCircle, ArrowRight, Mail } from 'lucide-react';

export function DeclineScreen() {
  const { reset } = useAppointmentForm();

  return (
    <div className="text-center space-y-6 animate-fade-in">
      {/* İkon */}
      <div className="flex justify-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center screen-icon-bg-amber"
        >
          <MessageCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
      </div>

      {/* Başlık & Açıklama */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Doğrudan Mesaj Gönderin!</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          Talebiniz için teşekkürler! Paylaştığınız bilgilere göre tam kapsamlı bir
          randevuya gerek olmayabilir. Bana doğrudan e-posta ile ulaşabilirsiniz;
          en kısa sürede yanıt vereceğim.
        </p>
      </div>

      {/* E-posta butonu */}
      <a
        href="mailto:user@example.com"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold shadow-md transition-all duration-200 px-5 py-2.5 text-sm bg-brand-600 hover:bg-brand-500 text-white hover:scale-105 active:scale-95"
      >
        <Mail className="w-4 h-4" />
        user@example.com adresine yaz
      </a>

      {/* Yeniden başla */}
      <Button variant="secondary" onClick={reset} className="w-full group">
        Yeniden Başla
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Button>
    </div>
  );
}
