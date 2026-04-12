import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Plus, Users, Send, Paperclip, Copy, LogOut,
  Hash, Loader2, FileText, Download, ChevronLeft,
  Phone, Video, Check, CheckCheck, UserPlus, Shield,
  Smile, BookOpen, Share2, Mic, MonitorUp, Pencil, Trash2, MoreVertical, X,
  Reply, CornerDownRight, ExternalLink
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useChatRooms, useChatMembers, useChatMessages, useCreateRoom,
  useJoinRoom, useSendMessage, useUploadChatFile, useLeaveRoom,
  useEditMessage, useDeleteMessage, useRoomPreviews,
  type ChatRoom, type ChatMessage
} from "@/hooks/useChat";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useWebRTC } from "@/hooks/useWebRTC";
import { usePresence } from "@/hooks/usePresence";
import { useReactions } from "@/hooks/useReactions";
import VideoCallOverlay from "@/components/chat/VideoCallOverlay";
import IncomingCallOverlay from "@/components/chat/IncomingCallOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { playMessageSound, showBrowserNotification } from "@/lib/notificationSounds";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "💯"];

const statusDotClasses = {
  online: "bg-success",
  offline: "bg-muted-foreground/30",
} as const;

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

  const roomIds = rooms.map((r) => r.id);
  const { data: roomPreviews = new Map() } = useRoomPreviews(roomIds, user?.id);

  const handleCreate = async () => {
    if (!newRoomName.trim()) return;
    try {
      const room = await createRoom.mutateAsync(newRoomName.trim());
      setNewRoomName("");
      setShowCreate(false);
      setSelectedRoom(room);
    } catch {}
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      const room = await joinRoom.mutateAsync(inviteCode.trim());
      setInviteCode("");
      setShowJoin(false);
      setSelectedRoom(room);
    } catch {}
  };

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Room list sidebar */}
        <div className={`w-80 flex-shrink-0 flex flex-col border-r border-border bg-card/30 ${selectedRoom ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b border-border space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Study Chat</h2>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setShowCreate(true); setShowJoin(false); }} className="flex-1 gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" /> Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowJoin(true); setShowCreate(false); }} className="flex-1 gap-1.5 h-8 text-xs">
                <UserPlus className="w-3.5 h-3.5" /> Join
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-border">
                <div className="p-3 space-y-2">
                  <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Room name..." className="text-sm h-8" onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreate} disabled={createRoom.isPending || !newRoomName.trim()} className="flex-1 h-7 text-xs">
                      {createRoom.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Create
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)} className="h-7 text-xs">Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showJoin && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-border">
                <div className="p-3 space-y-2">
                  <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Invite code..." className="text-sm h-8 font-mono" onKeyDown={(e) => e.key === "Enter" && handleJoin()} autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleJoin} disabled={joinRoom.isPending || !inviteCode.trim()} className="flex-1 h-7 text-xs">
                      {joinRoom.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Join
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowJoin(false)} className="h-7 text-xs">Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoading && (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 text-muted-foreground mx-auto animate-spin mb-2" />
                  <p className="text-xs text-muted-foreground">Loading rooms...</p>
                </div>
              )}
              {rooms.map((room) => {
                const preview = roomPreviews.get(room.id);
                const lastMsg = preview?.lastMessage;
                const unread = preview?.unreadCount || 0;
                return (
                  <button key={room.id} onClick={() => setSelectedRoom(room)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${selectedRoom?.id === room.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50 border border-transparent"}`}>
                    <div className="relative w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      {unread > 0 && (
                        <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground border-2 border-background">
                          {unread > 99 ? "99+" : unread}
                        </Badge>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{room.name}</p>
                        {lastMsg && <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDistanceToNow(new Date(lastMsg.created_at), { addSuffix: false })}</span>}
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {lastMsg ? lastMsg.message_type === "file" ? `📎 ${lastMsg.file_name || "File"}` : lastMsg.content : "No messages yet"}
                      </p>
                    </div>
                  </button>
                );
              })}
              {rooms.length === 0 && !isLoading && <EmptyRoomsState onCreateClick={() => setShowCreate(true)} onJoinClick={() => setShowJoin(true)} />}
            </div>
          </ScrollArea>
        </div>

        {selectedRoom ? (
          <ChatView room={selectedRoom} userId={user?.id || ""} onBack={() => setSelectedRoom(null)} onLeave={async () => { try { await leaveRoom.mutateAsync(selectedRoom.id); setSelectedRoom(null); } catch {} }} />
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center bg-muted/10"><NoChatSelectedState /></div>
        )}
      </div>
    </TooltipProvider>
  );
}

function EmptyRoomsState({ onCreateClick, onJoinClick }: { onCreateClick: () => void; onJoinClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 px-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><Users className="w-7 h-7 text-primary" /></div>
      <h3 className="text-sm font-semibold text-foreground mb-1">Start Studying Together</h3>
      <p className="text-xs text-muted-foreground mb-5 leading-relaxed">Create a room and invite friends, or join with an invite code.</p>
      <div className="space-y-2">
        <Button size="sm" onClick={onCreateClick} className="w-full gap-1.5"><Plus className="w-4 h-4" /> Create Room</Button>
        <Button size="sm" variant="outline" onClick={onJoinClick} className="w-full gap-1.5"><UserPlus className="w-4 h-4" /> Join Room</Button>
      </div>
    </motion.div>
  );
}

function NoChatSelectedState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-xs">
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"><MessageSquare className="w-10 h-10 text-muted-foreground/30" /></div>
      <h3 className="text-base font-semibold text-foreground mb-1">Select a Room</h3>
      <p className="text-sm text-muted-foreground">Pick a study room to start chatting</p>
    </motion.div>
  );
}

function OnlineStatusDot({ isOnline, size = "sm" }: { isOnline: boolean; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";
  return <span className={`${sizeClass} rounded-full border-2 border-background ${isOnline ? statusDotClasses.online : statusDotClasses.offline}`} />;
}

function ChatView({ room, userId, onBack, onLeave }: { room: ChatRoom; userId: string; onBack: () => void; onLeave: () => void }) {
  const { data: messages = [] } = useChatMessages(room.id);
  const { data: members = [] } = useChatMembers(room.id);
  const sendMessage = useSendMessage();
  const uploadFile = useUploadChatFile();
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(room.id);
  const { markAsRead } = useReadReceipts();
  const webrtc = useWebRTC(room.id);
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const { isOnline } = usePresence(room.id);
  const { getReactionsForMessage, toggleReaction } = useReactions(room.id);

  const [text, setText] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messageMap = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const prevMsgCount = useRef(messages.length);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    // Play sound for new messages from others
    if (messages.length > prevMsgCount.current) {
      const latest = messages[messages.length - 1];
      if (latest && latest.user_id !== userId) {
        playMessageSound();
        if (document.hidden) {
          const sender = memberMap.get(latest.user_id) || "Someone";
          showBrowserNotification(
            `New message from ${sender}`,
            latest.message_type === "file" ? `📎 ${latest.file_name}` : latest.content.slice(0, 80),
            `msg-${latest.id}`
          );
        }
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    const unread = messages.filter((m) => m.user_id !== userId && !(m as any).read_by?.includes(userId)).map((m) => m.id);
    if (unread.length > 0) markAsRead(unread);
  }, [messages, userId, markAsRead]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text;
    const replyId = replyTo?.id;
    setText("");
    setReplyTo(null);
    stopTyping();
    await sendMessage.mutateAsync({ roomId: room.id, content: msg, replyToId: replyId });
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyTo(msg);
    inputRef.current?.focus();
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
    if (!room.invite_code) { toast.error("No invite code available"); return; }
    navigator.clipboard.writeText(room.invite_code);
    toast.success(`Invite code copied: ${room.invite_code}`);
  };

  const handleStartCall = (video: boolean) => {
    const memberIds = members.map((m) => m.user_id);
    webrtc.startCall(memberIds, video, memberMap);
    toast.info(video ? "Starting video call..." : "Starting voice call...");
  };

  return (
    <>
      {webrtc.incomingCall && webrtc.callState === "ringing" && (
        <IncomingCallOverlay
          call={webrtc.incomingCall}
          onAccept={webrtc.acceptCall}
          onReject={webrtc.rejectCall}
        />
      )}

      {webrtc.callState !== "idle" && webrtc.callState !== "ringing" && (
        <VideoCallOverlay
          localStream={webrtc.localStream}
          screenStream={webrtc.screenStream}
          remoteStreams={webrtc.remoteStreams}
          isAudioEnabled={webrtc.isAudioEnabled}
          isVideoEnabled={webrtc.isVideoEnabled}
          isScreenSharing={webrtc.isScreenSharing}
          memberNames={memberMap}
          callDuration={webrtc.callDuration}
          onToggleAudio={webrtc.toggleAudio}
          onToggleVideo={webrtc.toggleVideo}
          onStartScreenShare={webrtc.startScreenShare}
          onStopScreenShare={webrtc.stopScreenShare}
          onEndCall={webrtc.endCall}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{room.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {members.length} member{members.length !== 1 ? "s" : ""} · <span className="text-success">{onlineCount} online</span>
                {room.invite_code && (
                  <button onClick={copyInvite} className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono hover:bg-primary/10 hover:text-primary transition-colors">
                    {room.invite_code}
                  </button>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleStartCall(false)} className="h-9 w-9"><Phone className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Voice Call</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleStartCall(true)} className="h-9 w-9"><Video className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Video Call</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={copyInvite} className="h-9 w-9"><Share2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Copy Invite Code</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant={showMembers ? "secondary" : "ghost"} size="icon" onClick={() => setShowMembers(!showMembers)} className="h-9 w-9"><Users className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Members ({members.length}/7)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={onLeave} className="h-9 w-9 text-destructive hover:text-destructive"><LogOut className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Leave Room</TooltipContent></Tooltip>
          </div>
        </div>

        {/* Members panel */}
        <AnimatePresence>
          {showMembers && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border flex-shrink-0">
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Room Members ({members.length}/7)</p>
                  <Button variant="ghost" size="sm" onClick={copyInvite} className="h-6 text-[10px] gap-1"><UserPlus className="w-3 h-3" /> Invite</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
                      <div className="relative">
                        <Avatar className="w-5 h-5"><AvatarFallback className="text-[8px] bg-primary/10 text-primary">{(m.display_name || "U")[0].toUpperCase()}</AvatarFallback></Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${isOnline(m.user_id) ? statusDotClasses.online : statusDotClasses.offline}`} />
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
          <div className="space-y-3 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3"><MessageSquare className="w-8 h-8 text-muted-foreground/30" /></div>
                <h4 className="text-sm font-medium text-foreground mb-1">No messages yet</h4>
                <p className="text-xs text-muted-foreground mb-4">Start the conversation!</p>
              </motion.div>
            )}

            {messages.map((msg) => {
              const repliedMsg = msg.reply_to_id ? messageMap.get(msg.reply_to_id) : null;
              const repliedSender = repliedMsg ? (memberMap.get(repliedMsg.user_id) || "User") : null;
              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.user_id === userId}
                  senderName={memberMap.get(msg.user_id) || "User"}
                  userId={userId}
                  roomId={room.id}
                  reactions={getReactionsForMessage(msg.id)}
                  onReact={(emoji) => toggleReaction({ messageId: msg.id, emoji })}
                  onEdit={(content) => editMessage.mutate({ messageId: msg.id, content, roomId: room.id })}
                  onDelete={() => deleteMessage.mutate({ messageId: msg.id, roomId: room.id })}
                  onReply={() => handleReply(msg)}
                  repliedMessage={repliedMsg || undefined}
                  repliedSenderName={repliedSender || undefined}
                />
              );
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="px-4 pb-1 flex-shrink-0">
            <p className="text-[11px] text-muted-foreground animate-pulse">
              {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
            </p>
          </div>
        )}

        {/* Reply preview */}
        {replyTo && (
          <div className="px-4 pt-2 border-t border-border flex-shrink-0">
            <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 max-w-3xl mx-auto">
              <CornerDownRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-primary">Replying to {memberMap.get(replyTo.user_id) || "User"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{replyTo.message_type === "file" ? `📎 ${replyTo.file_name}` : replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="p-3 border-t border-border bg-card/40 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.doc,.pptx,.txt,.png,.jpg,.jpeg,.gif,.xlsx,.csv" />
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => fileRef.current?.click()} disabled={uploadFile.isPending}>
              {uploadFile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button></TooltipTrigger><TooltipContent>Attach file (max 20MB)</TooltipContent></Tooltip>
            <Input ref={inputRef} value={text} onChange={(e) => { setText(e.target.value); sendTyping(); }} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder={replyTo ? "Type your reply..." : "Type a message..."} className="h-10 text-sm flex-1" />
            <Button size="icon" className="h-10 w-10 flex-shrink-0" onClick={handleSend} disabled={!text.trim() || sendMessage.isPending}><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Message Bubble ─── */
function MessageBubble({ msg, isOwn, senderName, userId, roomId, reactions, onReact, onEdit, onDelete, onReply, repliedMessage, repliedSenderName }: {
  msg: ChatMessage; isOwn: boolean; senderName: string; userId: string; roomId: string;
  reactions: Map<string, { count: number; users: string[]; hasReacted: boolean }>;
  onReact: (emoji: string) => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onReply: () => void;
  repliedMessage?: ChatMessage;
  repliedSenderName?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isFile = msg.message_type === "file" && msg.file_url;
  const ext = msg.file_name?.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isRead = isOwn && msg.read_by && msg.read_by.length > 0;
  const isEdited = !!msg.edited_at;

  const handleSaveEdit = () => {
    if (!editText.trim() || editText === msg.content) { setIsEditing(false); return; }
    onEdit(editText.trim());
    setIsEditing(false);
  };

  const handleOpenFile = () => {
    if (msg.file_url) window.open(msg.file_url, "_blank");
  };

  const handleDownloadFile = async () => {
    if (!msg.file_url) return;
    try {
      const resp = await fetch(msg.file_url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = msg.file_name || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(msg.file_url, "_blank");
    }
  };

  const bubbleTone = isOwn
    ? "bg-primary text-primary-foreground rounded-br-md"
    : "bg-muted text-foreground rounded-bl-md";

  const bubbleActionTone = isOwn
    ? "bg-background/90 border border-border/70 shadow-sm"
    : "bg-card/90 border border-border/70 shadow-sm";

  return (
    <>
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
        <div className={`max-w-[75%] ${isOwn ? "order-2" : ""}`}>
          {!isOwn && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1 font-medium">{senderName}</p>}
          <div className="relative">
            <div className={`rounded-2xl px-3.5 py-2.5 ${bubbleTone}`}>
              {repliedMessage && (
                <div className={`mb-1.5 rounded-lg px-2.5 py-1.5 border-l-2 ${isOwn ? "bg-background/15 border-primary-foreground/40" : "bg-background/40 border-primary/60"}`}>
                  <p className={`text-[10px] font-semibold ${isOwn ? "text-primary-foreground/80" : "text-primary"}`}>{repliedSenderName}</p>
                  <p className={`text-[11px] truncate ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {repliedMessage.message_type === "file" ? `📎 ${repliedMessage.file_name}` : repliedMessage.content}
                  </p>
                </div>
              )}
              {isEditing ? (
                <div className="space-y-2">
                  <Input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setIsEditing(false); }} className="h-7 text-sm bg-background/20 border-background/30" autoFocus />
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={handleSaveEdit} className="h-6 text-[10px] px-2">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditText(msg.content); }} className="h-6 text-[10px] px-2"><X className="w-3 h-3" /></Button>
                  </div>
                </div>
              ) : isFile ? (
                <div className="space-y-2">
                  {isImage ? (
                    <img src={msg.file_url!} alt={msg.file_name || "image"} className="rounded-lg max-w-[280px] max-h-[240px] object-cover cursor-pointer" onClick={handleOpenFile} />
                  ) : (
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${isOwn ? "bg-background/15" : "bg-muted/60"}`}>
                      <FileText className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{msg.file_name}</p>
                        {msg.file_size && <p className="text-[10px] opacity-70">{(msg.file_size / 1024).toFixed(1)} KB</p>}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <button onClick={handleOpenFile} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${isOwn ? "bg-background/20 hover:bg-background/30 text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
                      <ExternalLink className="w-3 h-3" /> Open
                    </button>
                    <button onClick={handleDownloadFile} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${isOwn ? "bg-background/20 hover:bg-background/30 text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"}`}>
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className={`absolute ${isOwn ? "-left-20" : "-right-20"} top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}>
              <button onClick={onReply} className={`w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center ${bubbleActionTone}`} title="Reply">
                <Reply className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center ${bubbleActionTone}`}>
                    <Smile className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top">
                  <div className="flex gap-1">
                    {EMOJI_LIST.map((emoji) => (
                      <button key={emoji} onClick={() => onReact(emoji)} className="hover:bg-muted rounded-md p-1.5 text-base transition-colors hover:scale-110">{emoji}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {isOwn && !isFile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center ${bubbleActionTone}`}>
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-32">
                    <DropdownMenuItem onClick={() => { setEditText(msg.content); setIsEditing(true); }} className="text-xs gap-2"><Pencil className="w-3.5 h-3.5" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-xs gap-2 text-destructive focus:text-destructive"><Trash2 className="w-3.5 h-3.5" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {isOwn && isFile && (
                <button onClick={() => setShowDeleteDialog(true)} className={`w-7 h-7 rounded-full hover:bg-destructive/20 flex items-center justify-center ${bubbleActionTone}`}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Reactions */}
          {reactions.size > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end mr-1" : "ml-1"}`}>
              {Array.from(reactions.entries()).map(([emoji, data]) => (
                <button key={emoji} onClick={() => onReact(emoji)}
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border transition-colors ${data.hasReacted ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/50 border-border hover:bg-muted"}`}>
                  <span>{emoji}</span><span className="text-[10px] font-medium">{data.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end mr-1" : "ml-1"}`}>
            <p className="text-[9px] text-muted-foreground">{format(new Date(msg.created_at), "h:mm a")}</p>
            {isEdited && <p className="text-[9px] text-muted-foreground/60">(edited)</p>}
            {isOwn && (isRead ? <CheckCheck className="w-3 h-3 text-primary" /> : <Check className="w-3 h-3 text-muted-foreground" />)}
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
