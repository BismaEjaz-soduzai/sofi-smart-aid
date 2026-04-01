import { useState, useRef } from "react";
import { User, Camera, Save, Mail, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import PageShell from "@/components/PageShell";
import { format } from "date-fns";

export default function ProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (profile && !initialized) {
    setDisplayName(profile.display_name || "");
    setBio(profile.bio || "");
    setInitialized(true);
  }

  const initials = (displayName || user?.email?.split("@")[0] || "U")
    .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { return; }
    await uploadAvatar.mutateAsync(file);
  };

  const handleSave = () => {
    updateProfile.mutate({ display_name: displayName, bio });
  };

  if (isLoading) {
    return (
      <PageShell title="Profile" description="Manage your profile" icon={User}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Profile" description="Manage your profile and preferences" icon={User}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Avatar section */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="w-20 h-20">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="Avatar" />}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
                disabled={uploadAvatar.isPending}
              >
                {uploadAvatar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{displayName || "Set your name"}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user?.email}
              </p>
              {user?.created_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Calendar className="w-3 h-3" /> Joined {format(new Date(user.created_at), "MMM yyyy")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
          <Separator />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="h-9" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
            <Input value={user?.email || ""} disabled className="h-9 opacity-60" />
          </div>
          <Button onClick={handleSave} disabled={updateProfile.isPending} size="sm">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
