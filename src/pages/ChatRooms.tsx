import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Plus, Users, Send, Paperclip, Copy, LogOut,
  Hash, Loader2, FileText, Download, ChevronLeft,
  Phone, Video, Check, CheckCheck, UserPlus, Shield,
  Smile, BookOpen, Share2, Mic, MonitorUp, Pencil, Trash2, MoreVertical, X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useChatRooms, useChatMembers, useChatMessages, useCreateRoom,
  useJoinRoom, useSendMessage, useUploadChatFile, useLeaveRoom,
  type ChatRoom, type ChatMessage
} from "@/hooks/useChat";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePresence } from "@/hooks/usePresence";
import { useReactions } from "@/hooks/useReactions";
import VideoCallOverlay from "@/components/chat/VideoCallOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import PageShell from "@/components/PageShell";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "💯"];

export default function ChatRooms() {
  const { user } = useAuth();
  const { data: rooms = [], isLoading } = useChatRooms();
  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();
  const leaveRoom = useLeaveRoom();

  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const handleCreate = async () => {
    if (!newRoomName.trim()) return;
    try {
      const room = await createRoom.mutateAsync(newRoomName.trim());
      setNewRoomName("");
      setShowCreate(false);
      setSelectedRoom(room);
    } catch {
      // error toast is handled by the mutation's onError
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      const room = await joinRoom.mutateAsync(inviteCode.trim());
      setInviteCode("");
      setShowJoin(false);
      setSelectedRoom(room);
    } catch {
      // error toast is handled by the mutation's onError
    }
  };

  return (
    <PageShell title="Study Chat" description="Collaborate with friends in real-time" icon={MessageSquare}>
      <TooltipProvider>
        <div className="flex gap-4 h-[calc(100vh-180px)] max-w-5xl">
          {/* Room list sidebar */}
          <div className={`w-80 flex-shrink-0 flex flex-col ${selectedRoom ? "hidden md:flex" : "flex"}`}>
            <div className="flex gap-2 mb-4">
              <Button size="sm" onClick={() => { setShowCreate(true); setShowJoin(false); }} className="flex-1 gap-1.5">
                <Plus className="w-4 h-4" /> Create Room
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowJoin(true); setShowCreate(false); }} className="flex-1 gap-1.5">
                <UserPlus className="w-4 h-4" /> Join Room
              </Button>
            </div>

            <AnimatePresence>
              {showCreate && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="glass-card p-4 mb-4 space-y-3 border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center"><Plus className="w-3.5 h-3.5 text-primary" /></div>
                      <span className="text-sm font-medium text-foreground">Create a Study Room</span>
                    </div>
                    <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g., Math Study Group, FYP Team..." className="text-sm" onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
                    <p className="text-[11px] text-muted-foreground">You'll get an invite code to share with up to 6 friends.</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreate} disabled={createRoom.isPending || !newRoomName.trim()} className="flex-1">
                        {createRoom.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        Create Room
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showJoin && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="glass-card p-4 mb-4 space-y-3 border border-accent/40">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-md bg-accent/20 flex items-center justify-center"><Hash className="w-3.5 h-3.5 text-accent-foreground" /></div>
                      <span className="text-sm font-medium text-foreground">Join a Study Room</span>
                    </div>
                    <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Paste invite code here..." className="text-sm font-mono" onKeyDown={(e) => e.key === "Enter" && handleJoin()} autoFocus />
                    <p className="text-[11px] text-muted-foreground">Ask a room member to share their invite code with you.</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleJoin} disabled={joinRoom.isPending || !inviteCode.trim()} className="flex-1">
                        {joinRoom.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        Join Room
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowJoin(false)}>Cancel</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <ScrollArea className="flex-1">
              <div className="space-y-1.5">
                {isLoading && (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 text-muted-foreground mx-auto animate-spin mb-2" />
                    <p className="text-xs text-muted-foreground">Loading rooms...</p>
                  </div>
                )}
                {rooms.map((room) => (
                  <button key={room.id} onClick={() => setSelectedRoom(room)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${selectedRoom?.id === room.id ? "bg-primary/10 border border-primary/20 shadow-sm" : "hover:bg-muted/50 border border-transparent"}`}>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{room.name}</p>
                      <p className="text-[11px] text-muted-foreground">Created {format(new Date(room.created_at), "MMM d, yyyy")}</p>
                    </div>
                  </button>
                ))}
                {rooms.length === 0 && !isLoading && (
                  <EmptyRoomsState onCreateClick={() => setShowCreate(true)} onJoinClick={() => setShowJoin(true)} />
                )}
              </div>
            </ScrollArea>
          </div>

          {selectedRoom ? (
            <ChatView room={selectedRoom} userId={user?.id || ""} onBack={() => setSelectedRoom(null)} onLeave={async () => { try { await leaveRoom.mutateAsync(selectedRoom.id); setSelectedRoom(null); } catch {} }} />
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center"><NoChatSelectedState /></div>
          )}
        </div>
      </TooltipProvider>
    </PageShell>
  );
}

/* ─── Empty states ─── */

function EmptyRoomsState({ onCreateClick, onJoinClick }: { onCreateClick: () => void; onJoinClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><Users className="w-8 h-8 text-primary" /></div>
      <h3 className="text-sm font-semibold text-foreground mb-1">Start Studying Together</h3>
      <p className="text-xs text-muted-foreground mb-5 leading-relaxed">Create a room and invite friends, or join an existing room with an invite code.</p>
      <div className="space-y-2">
        <Button size="sm" onClick={onCreateClick} className="w-full gap-1.5"><Plus className="w-4 h-4" /> Create Your First Room</Button>
        <Button size="sm" variant="outline" onClick={onJoinClick} className="w-full gap-1.5"><UserPlus className="w-4 h-4" /> Join with Invite Code</Button>
      </div>
      <div className="mt-6 space-y-2.5 text-left">
        <FeatureHint icon={MessageSquare} text="Chat and share files in real-time" />
        <FeatureHint icon={Video} text="Video call and screen share with your group" />
        <FeatureHint icon={Paperclip} text="Share documents, images, and study materials" />
        <FeatureHint icon={Shield} text="Private rooms with invite-only access (max 7)" />
      </div>
    </motion.div>
  );
}

function FeatureHint({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-muted/80 flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-muted-foreground" /></div>
      <span className="text-[11px] text-muted-foreground">{text}</span>
    </div>
  );
}

function NoChatSelectedState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-xs">
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"><MessageSquare className="w-10 h-10 text-muted-foreground/30" /></div>
      <h3 className="text-base font-semibold text-foreground mb-1">Select a Room</h3>
      <p className="text-sm text-muted-foreground mb-6">Pick a study room from the sidebar to start chatting, sharing files, or hopping on a call.</p>
      <div className="grid grid-cols-2 gap-3 text-left">
        <QuickFeatureCard icon={MessageSquare} title="Chat" desc="Real-time messaging" />
        <QuickFeatureCard icon={Video} title="Video Call" desc="Face-to-face study" />
        <QuickFeatureCard icon={Paperclip} title="Share Files" desc="PDFs, docs & images" />
        <QuickFeatureCard icon={MonitorUp} title="Screen Share" desc="Present to your group" />
      </div>
    </motion.div>
  );
}

function QuickFeatureCard({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-muted/30 border border-border/50 p-3">
      <Icon className="w-4 h-4 text-primary mb-1.5" />
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </div>
  );
}

/* ─── Online Status Dot ─── */

function OnlineStatusDot({ isOnline, size = "sm" }: { isOnline: boolean; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";
  return (
    <span className={`${sizeClass} rounded-full border-2 border-background ${isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
  );
}

/* ─── Chat View ─── */

function ChatView({ room, userId, onBack, onLeave }: { room: ChatRoom; userId: string; onBack: () => void; onLeave: () => void }) {
  const { data: messages = [] } = useChatMessages(room.id);
  const { data: members = [] } = useChatMembers(room.id);
  const sendMessage = useSendMessage();
  const uploadFile = useUploadChatFile();
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(room.id);
  const { markAsRead } = useReadReceipts();
  const webrtc = useWebRTC(room.id);
  const { isOnline } = usePresence(room.id);
  const { getReactionsForMessage, toggleReaction } = useReactions(room.id);

  const [text, setText] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    const unread = messages
      .filter((m) => m.user_id !== userId && !(m as any).read_by?.includes(userId))
      .map((m) => m.id);
    if (unread.length > 0) markAsRead(unread);
  }, [messages, userId, markAsRead]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text;
    setText("");
    stopTyping();
    await sendMessage.mutateAsync({ roomId: room.id, content: msg });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20MB)"); return; }
    const result = await uploadFile.mutateAsync(file);
    await sendMessage.mutateAsync({
      roomId: room.id,
      content: `Shared a file: ${result.name}`,
      messageType: "file",
      fileName: result.name,
      fileUrl: result.url,
      fileSize: result.size,
    });
    e.target.value = "";
  };

  const memberMap = new Map(members.map((m) => [m.user_id, m.display_name || "User"]));
  const typingNames = typingUsers.map((id) => memberMap.get(id) || "Someone").filter(Boolean);
  const onlineCount = members.filter((m) => isOnline(m.user_id)).length;

  const copyInvite = () => {
    navigator.clipboard.writeText(room.invite_code);
    toast.success("Invite code copied! Share it with friends to let them join.");
  };

  const handleStartCall = (video: boolean) => {
    const memberIds = members.map((m) => m.user_id);
    webrtc.startCall(memberIds, video);
    toast.info(video ? "Starting video call..." : "Starting voice call...");
  };

  return (
    <>
      {webrtc.callState !== "idle" && (
        <VideoCallOverlay
          localStream={webrtc.localStream}
          screenStream={webrtc.screenStream}
          remoteStreams={webrtc.remoteStreams}
          isAudioEnabled={webrtc.isAudioEnabled}
          isVideoEnabled={webrtc.isVideoEnabled}
          isScreenSharing={webrtc.isScreenSharing}
          memberNames={memberMap}
          onToggleAudio={webrtc.toggleAudio}
          onToggleVideo={webrtc.toggleVideo}
          onStartScreenShare={webrtc.startScreenShare}
          onStopScreenShare={webrtc.stopScreenShare}
          onEndCall={webrtc.endCall}
        />
      )}

      <div className="flex-1 flex flex-col glass-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{room.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {members.length} member{members.length !== 1 ? "s" : ""} • <span className="text-green-500">{onlineCount} online</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleStartCall(false)} className="h-8 w-8"><Phone className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Voice Call</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleStartCall(true)} className="h-8 w-8"><Video className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Video Call</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={copyInvite} className="h-8 w-8"><Share2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Copy Invite Code</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant={showMembers ? "secondary" : "ghost"} size="icon" onClick={() => setShowMembers(!showMembers)} className="h-8 w-8"><Users className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Members ({members.length}/7)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onLeave} className="h-8 w-8 text-destructive hover:text-destructive"><LogOut className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Leave Room</TooltipContent></Tooltip>
          </div>
        </div>

        {/* Members panel */}
        <AnimatePresence>
          {showMembers && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border">
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Room Members ({members.length}/7)</p>
                  <Button variant="ghost" size="sm" onClick={copyInvite} className="h-6 text-[10px] gap-1"><UserPlus className="w-3 h-3" /> Invite Friends</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
                      <div className="relative">
                        <Avatar className="w-5 h-5">
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{(m.display_name || "U")[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${isOnline(m.user_id) ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                      </div>
                      <span className="text-xs text-foreground">{m.display_name || "User"}</span>
                      {m.user_id === room.created_by && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Owner</span>}
                      {m.user_id === userId && <span className="text-[9px] text-muted-foreground">(You)</span>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><MessageSquare className="w-7 h-7 text-muted-foreground/40" /></div>
                <h4 className="text-sm font-medium text-foreground mb-1">No messages yet</h4>
                <p className="text-xs text-muted-foreground mb-4 max-w-[250px] mx-auto">Start the conversation! Send messages, share files, or start a video call.</p>
                <div className="flex items-center justify-center gap-4 text-muted-foreground">
                  <div className="flex flex-col items-center gap-1"><div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center"><Send className="w-3.5 h-3.5" /></div><span className="text-[10px]">Message</span></div>
                  <div className="flex flex-col items-center gap-1"><div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center"><Paperclip className="w-3.5 h-3.5" /></div><span className="text-[10px]">File</span></div>
                  <div className="flex flex-col items-center gap-1"><div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center"><Video className="w-3.5 h-3.5" /></div><span className="text-[10px]">Call</span></div>
                </div>
              </motion.div>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.user_id === userId}
                senderName={memberMap.get(msg.user_id) || "User"}
                userId={userId}
                reactions={getReactionsForMessage(msg.id)}
                onReact={(emoji) => toggleReaction({ messageId: msg.id, emoji })}
              />
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="px-4 pb-1">
            <p className="text-[11px] text-muted-foreground animate-pulse">
              {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
            </p>
          </div>
        )}

        {/* Input bar */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.doc,.pptx,.txt,.png,.jpg,.jpeg,.gif,.xlsx,.csv" />
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => fileRef.current?.click()} disabled={uploadFile.isPending}>
              {uploadFile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button></TooltipTrigger><TooltipContent>Attach file (max 20MB)</TooltipContent></Tooltip>
            <Input value={text} onChange={(e) => { setText(e.target.value); sendTyping(); }} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder="Type a message..." className="h-9 text-sm flex-1" />
            <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSend} disabled={!text.trim() || sendMessage.isPending}><Send className="w-4 h-4" /></Button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 ml-11">Press Enter to send • Attach PDFs, images & documents</p>
        </div>
      </div>
    </>
  );
}

/* ─── Message Bubble ─── */

function MessageBubble({ msg, isOwn, senderName, userId, reactions, onReact }: {
  msg: ChatMessage; isOwn: boolean; senderName: string; userId: string;
  reactions: Map<string, { count: number; users: string[]; hasReacted: boolean }>;
  onReact: (emoji: string) => void;
}) {
  const isFile = msg.message_type === "file" && msg.file_url;
  const ext = msg.file_name?.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const readBy = (msg as any).read_by as string[] | undefined;
  const isRead = isOwn && readBy && readBy.length > 0;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[75%] ${isOwn ? "order-2" : ""}`}>
        {!isOwn && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1 font-medium">{senderName}</p>}
        <div className="relative">
          <div className={`rounded-2xl px-3.5 py-2 ${isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
            {isFile ? (
              <div className="space-y-1.5">
                {isImage ? (
                  <img src={msg.file_url!} alt={msg.file_name || "image"} className="rounded-lg max-w-[240px] max-h-[200px] object-cover" />
                ) : (
                  <a href={msg.file_url!} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-xs ${isOwn ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-foreground/80 hover:text-foreground"} transition-colors`}>
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{msg.file_name}</span>
                    <Download className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
            )}
          </div>

          {/* Emoji reaction button (appears on hover) */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={`absolute ${isOwn ? "-left-8" : "-right-8"} top-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center`}>
                <Smile className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" side="top">
              <div className="flex gap-1">
                {EMOJI_LIST.map((emoji) => (
                  <button key={emoji} onClick={() => onReact(emoji)} className="hover:bg-muted rounded-md p-1.5 text-base transition-colors hover:scale-110">
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Reactions display */}
        {reactions.size > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end mr-1" : "ml-1"}`}>
            {Array.from(reactions.entries()).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border transition-colors ${
                  data.hasReacted
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-border hover:bg-muted"
                }`}
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-medium">{data.count}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end mr-1" : "ml-1"}`}>
          <p className="text-[9px] text-muted-foreground">{format(new Date(msg.created_at), "h:mm a")}</p>
          {isOwn && (isRead ? <CheckCheck className="w-3 h-3 text-primary" /> : <Check className="w-3 h-3 text-muted-foreground" />)}
        </div>
      </div>
    </div>
  );
}
