interface Props {
  password: string;
}

export function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score = 1;
  if (score >= 1 && /[A-Z]/.test(password)) score = 2;
  if (score >= 2 && /[0-9]/.test(password)) score = 3;
  if (score >= 3 && /[^A-Za-z0-9]/.test(password)) score = 4;
  return score;
}

const LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const COLOR_CLASSES = [
  "bg-muted",
  "bg-destructive",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
];
const TEXT_CLASSES = [
  "text-muted-foreground",
  "text-destructive",
  "text-orange-500",
  "text-yellow-600",
  "text-green-600",
];

export default function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;
  const score = getPasswordStrength(password);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score ? COLOR_CLASSES[score] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center">
        <span className={`text-xs font-medium ${TEXT_CLASSES[score]}`}>
          {LABELS[score] || "Too short"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          8+ chars · uppercase · number · symbol
        </span>
      </div>
    </div>
  );
}
