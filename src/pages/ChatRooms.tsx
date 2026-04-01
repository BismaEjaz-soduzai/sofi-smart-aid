import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Plus, Users, Send, Paperclip, Copy, LogOut,
  X, Hash, Loader2, FileText, Image, Download, ChevronLeft
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useChatRooms, useChatMembers, useChatMessages, useCreateRoom,
  useJoinRoom, useSendMessage, useUploadChatFile, useLeaveRoom,
  type ChatRoom, type ChatMessage
} from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import PageShell from "@/components/PageShell";

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
    const room = await createRoom.mutateAsync(newRoomName.trim());
    setNewRoomName("");
    setShowCreate(false);
    setSelectedRoom(room);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    const room = await joinRoom.mutateAsync(inviteCode.trim());
    setInviteCode("");
    setShowJoin(false);
    setSelectedRoom(room);
  };

  return (
    <PageShell title="Study Chat" description="Chat and share documents with friends" icon={MessageSquare}>
      <div className="flex gap-4 h-[calc(100vh-180px)] max-w-5xl">
        {/* Room list */}
        <div className={`w-72 flex-shrink-0 flex flex-col ${selectedRoom ? "hidden md:flex" : "flex"}`}>
          <div className="flex gap-2 mb-3">
            <Button size="sm" onClick={() => setShowCreate(true)} className="flex-1 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Room
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowJoin(true)} className="flex-1 text-xs">
              <Hash className="w-3.5 h-3.5 mr-1" /> Join
            </Button>
          </div>

          {/* Create modal */}
          {showCreate && (
            <div className="glass-card p-3 mb-3 space-y-2">
              <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Room name..." className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={createRoom.isPending} className="flex-1 h-7 text-xs">Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)} className="h-7 text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {showJoin && (
            <div className="glass-card p-3 mb-3 space-y-2">
              <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Invite code..." className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleJoin} disabled={joinRoom.isPending} className="flex-1 h-7 text-xs">Join</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowJoin(false)} className="h-7 text-xs">Cancel</Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    selectedRoom?.id === room.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{room.name}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(room.created_at), "MMM d")}</p>
                  </div>
                </button>
              ))}
              {rooms.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No rooms yet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        {selectedRoom ? (
          <ChatView
            room={selectedRoom}
            userId={user?.id || ""}
            onBack={() => setSelectedRoom(null)}
            onLeave={async () => {
              await leaveRoom.mutateAsync(selectedRoom.id);
              setSelectedRoom(null);
            }}
          />
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a room to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ChatView({ room, userId, onBack, onLeave }: { room: ChatRoom; userId: string; onBack: () => void; onLeave: () => void }) {
  const { data: messages = [] } = useChatMessages(room.id);
  const { data: members = [] } = useChatMembers(room.id);
  const sendMessage = useSendMessage();
  const uploadFile = useUploadChatFile();
  const [text, setText] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text;
    setText("");
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

  const copyInvite = () => {
    navigator.clipboard.writeText(room.invite_code);
    toast.success("Invite code copied!");
  };

  return (
    <div className="flex-1 flex flex-col glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{room.name}</p>
            <p className="text-[10px] text-muted-foreground">{members.length} members</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={copyInvite} className="h-8 w-8" title="Copy invite code">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowMembers(!showMembers)} className="h-8 w-8">
            <Users className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onLeave} className="h-8 w-8 text-destructive hover:text-destructive">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Members panel */}
      <AnimatePresence>
        {showMembers && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-b border-border">
            <div className="p-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                      {(m.display_name || "U")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-foreground">{m.display_name || "User"}</span>
                  {m.user_id === room.created_by && <span className="text-[8px] text-primary font-medium">Owner</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} isOwn={msg.user_id === userId} senderName={memberMap.get(msg.user_id) || "User"} />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.doc,.pptx,.txt,.png,.jpg,.jpeg,.gif,.xlsx,.csv" />
        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => fileRef.current?.click()} disabled={uploadFile.isPending}>
          {uploadFile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          className="h-9 text-sm"
        />
        <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSend} disabled={!text.trim() || sendMessage.isPending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isOwn, senderName }: { msg: ChatMessage; isOwn: boolean; senderName: string }) {
  const isFile = msg.message_type === "file" && msg.file_url;
  const ext = msg.file_name?.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isOwn ? "order-2" : ""}`}>
        {!isOwn && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{senderName}</p>}
        <div className={`rounded-2xl px-3.5 py-2 ${isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
          {isFile ? (
            <div className="space-y-1.5">
              {isImage ? (
                <img src={msg.file_url!} alt={msg.file_name || "image"} className="rounded-lg max-w-[240px] max-h-[200px] object-cover" />
              ) : (
                <a href={msg.file_url!} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-xs ${isOwn ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-foreground/80 hover:text-foreground"}`}>
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
        <p className={`text-[9px] text-muted-foreground mt-0.5 ${isOwn ? "text-right mr-1" : "ml-1"}`}>
          {format(new Date(msg.created_at), "h:mm a")}
        </p>
      </div>
    </div>
  );
}
