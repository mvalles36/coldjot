"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Phone, Info, Play, Pause } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-hot-toast";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CallAssistantConfig } from "@coldjot/types";

interface SequenceCallEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: {
    assistantConfig?: CallAssistantConfig;
    note?: string;
  };
  sequenceId?: string;
  stepId?: string;
}

interface VapiAssistant {
  id: string;
  name: string;
  description?: string;
}

interface VapiVoice {
  id: string;
  name: string;
  previewUrl?: string;
  gender?: string;
  accent?: string;
  language?: string;
  imageUrl?: string;
}

interface VapiPhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName?: string;
  capabilities?: string[];
}

export function SequenceCallEditor({
  open,
  onClose,
  onSave,
  initialData,
  sequenceId,
  stepId,
}: SequenceCallEditorProps) {
  // State for assistant configuration
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>(
    initialData?.assistantConfig?.vapiAssistantId || ""
  );
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(
    initialData?.assistantConfig?.voiceId || ""
  );
  const [systemPrompt, setSystemPrompt] = useState<string>(
    initialData?.assistantConfig?.systemPrompt || ""
  );
  const [leaveVoicemail, setLeaveVoicemail] = useState<boolean>(
    initialData?.assistantConfig?.leaveVoicemail || false
  );
  const [voicemailText, setVoicemailText] = useState<string>(
    initialData?.assistantConfig?.voicemailText || ""
  );
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>(
    initialData?.assistantConfig?.phoneNumberId || ""
  );
  const [note, setNote] = useState<string>(initialData?.note || "");

  // State for API data
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [voices, setVoices] = useState<VapiVoice[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<VapiPhoneNumber[]>([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState<boolean>(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);
  const [isLoadingPhoneNumbers, setIsLoadingPhoneNumbers] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Audio preview state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>("");
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);

  // Fetch assistants, voices, and phone numbers when component mounts
  useEffect(() => {
    if (open) {
      fetchAssistants();
      fetchVoices();
      fetchPhoneNumbers();
    }
    
    return () => {
      // Clean up audio player when component unmounts
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = "";
      }
    };
  }, [open]);

  // Create audio player when audio preview URL changes
  useEffect(() => {
    if (audioPreviewUrl) {
      const player = new Audio(audioPreviewUrl);
      player.onended = () => setIsPlaying(false);
      setAudioPlayer(player);
      
      return () => {
        player.pause();
        player.src = "";
      };
    }
  }, [audioPreviewUrl]);

  // Reset state when initialData changes
  useEffect(() => {
    if (initialData?.assistantConfig) {
      setSelectedAssistantId(initialData.assistantConfig.vapiAssistantId);
      setSelectedVoiceId(initialData.assistantConfig.voiceId);
      setSystemPrompt(initialData.assistantConfig.systemPrompt);
      setLeaveVoicemail(initialData.assistantConfig.leaveVoicemail);
      setVoicemailText(initialData.assistantConfig.voicemailText || "");
      setSelectedPhoneNumberId(initialData.assistantConfig.phoneNumberId);
    }
    
    if (initialData?.note) {
      setNote(initialData.note);
    }
  }, [initialData]);

  // Fetch assistants from Vapi API
  const fetchAssistants = async () => {
    setIsLoadingAssistants(true);
    try {
      // In a real implementation, this would call your backend API
      // which would then call the Vapi API
      const response = await fetch("/api/vapi/assistants");
      if (!response.ok) {
        throw new Error("Failed to fetch assistants");
      }
      
      const data = await response.json();
      setAssistants(data.assistants);
      
      // If no assistant is selected and we have assistants, select the first one
      if (!selectedAssistantId && data.assistants.length > 0) {
        setSelectedAssistantId(data.assistants[0].id);
      }
    } catch (error) {
      console.error("Error fetching assistants:", error);
      toast.error("Failed to load assistants. Please check your Vapi API configuration.");
      
      // For demo purposes, add some sample assistants
      const sampleAssistants = [
        { id: "asst_123", name: "Sales Assistant", description: "For outbound sales calls" },
        { id: "asst_456", name: "Support Assistant", description: "For customer support" },
        { id: "asst_789", name: "Appointment Assistant", description: "For scheduling appointments" }
      ];
      setAssistants(sampleAssistants);
      if (!selectedAssistantId) {
        setSelectedAssistantId(sampleAssistants[0].id);
      }
    } finally {
      setIsLoadingAssistants(false);
    }
  };

  // Fetch voices from Vapi API
  const fetchVoices = async () => {
    setIsLoadingVoices(true);
    try {
      // In a real implementation, this would call your backend API
      const response = await fetch("/api/vapi/voices");
      if (!response.ok) {
        throw new Error("Failed to fetch voices");
      }
      
      const data = await response.json();
      setVoices(data.voices);
      
      // If no voice is selected and we have voices, select the first one
      if (!selectedVoiceId && data.voices.length > 0) {
        setSelectedVoiceId(data.voices[0].id);
      }
    } catch (error) {
      console.error("Error fetching voices:", error);
      toast.error("Failed to load voices. Please check your Vapi API configuration.");
      
      // For demo purposes, add some sample voices
      const sampleVoices = [
        { id: "voice_123", name: "Alex", gender: "male", accent: "American", language: "English", imageUrl: "https://ui-avatars.com/api/?name=Alex&background=0D8ABC&color=fff" },
        { id: "voice_456", name: "Sarah", gender: "female", accent: "British", language: "English", imageUrl: "https://ui-avatars.com/api/?name=Sarah&background=0D8ABC&color=fff" },
        { id: "voice_789", name: "Michael", gender: "male", accent: "Australian", language: "English", imageUrl: "https://ui-avatars.com/api/?name=Michael&background=0D8ABC&color=fff" }
      ];
      setVoices(sampleVoices);
      if (!selectedVoiceId) {
        setSelectedVoiceId(sampleVoices[0].id);
      }
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // Fetch phone numbers from Vapi API
  const fetchPhoneNumbers = async () => {
    setIsLoadingPhoneNumbers(true);
    try {
      // In a real implementation, this would call your backend API
      const response = await fetch("/api/vapi/phone-numbers");
      if (!response.ok) {
        throw new Error("Failed to fetch phone numbers");
      }
      
      const data = await response.json();
      setPhoneNumbers(data.phoneNumbers);
      
      // If no phone number is selected and we have phone numbers, select the first one
      if (!selectedPhoneNumberId && data.phoneNumbers.length > 0) {
        setSelectedPhoneNumberId(data.phoneNumbers[0].id);
      }
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      toast.error("Failed to load phone numbers. Please check your Vapi API configuration.");
      
      // For demo purposes, add some sample phone numbers
      const samplePhoneNumbers = [
        { id: "pn_123", phoneNumber: "+1 (555) 123-4567", friendlyName: "Sales Line" },
        { id: "pn_456", phoneNumber: "+1 (555) 987-6543", friendlyName: "Support Line" }
      ];
      setPhoneNumbers(samplePhoneNumbers);
      if (!selectedPhoneNumberId) {
        setSelectedPhoneNumberId(samplePhoneNumbers[0].id);
      }
    } finally {
      setIsLoadingPhoneNumbers(false);
    }
  };

  // Handle audio preview playback
  const togglePlayPreview = (voiceId: string) => {
    if (isPlaying && audioPlayer) {
      audioPlayer.pause();
      setIsPlaying(false);
      return;
    }
    
    // In a real implementation, this would fetch a preview URL for the selected voice
    // For now, we'll use a placeholder URL
    const previewUrl = `/api/vapi/voices/${voiceId}/preview`;
    setAudioPreviewUrl(previewUrl);
    
    // Play the audio
    if (audioPlayer) {
      audioPlayer.src = previewUrl;
      audioPlayer.play().catch(error => {
        console.error("Error playing audio:", error);
        toast.error("Failed to play voice preview.");
      });
      setIsPlaying(true);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAssistantId) {
      toast.error("Please select an assistant");
      return;
    }
    
    if (!selectedVoiceId) {
      toast.error("Please select a voice");
      return;
    }
    
    if (!selectedPhoneNumberId) {
      toast.error("Please select a phone number");
      return;
    }
    
    if (!systemPrompt.trim()) {
      toast.error("Please enter a system prompt for the assistant");
      return;
    }
    
    if (leaveVoicemail && !voicemailText.trim()) {
      toast.error("Please enter voicemail text or disable voicemail");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const assistantConfig: CallAssistantConfig = {
        vapiAssistantId: selectedAssistantId,
        voiceId: selectedVoiceId,
        systemPrompt,
        leaveVoicemail,
        voicemailText: leaveVoicemail ? voicemailText : undefined,
        phoneNumberId: selectedPhoneNumberId
      };
      
      onSave({
        assistantConfig,
        note
      });
    } catch (error) {
      console.error("Error saving call configuration:", error);
      toast.error("Failed to save call configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // Get selected voice details
  const getSelectedVoice = () => {
    return voices.find(voice => voice.id === selectedVoiceId);
  };

  // Get selected assistant details
  const getSelectedAssistant = () => {
    return assistants.find(assistant => assistant.id === selectedAssistantId);
  };

  // Get selected phone number details
  const getSelectedPhoneNumber = () => {
    return phoneNumbers.find(phoneNumber => phoneNumber.id === selectedPhoneNumberId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-11/12 sm:w-[100%] max-w-[100%] h-[100vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {initialData ? "Edit Call Configuration" : "Create Call Configuration"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-6 flex-1 min-h-0 p-0">
            {/* Left column - Configuration */}
            <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
              {/* Assistant Selection */}
              <div className="flex-shrink-0 space-y-2">
                <Label htmlFor="assistant">Call Assistant</Label>
                <Select
                  value={selectedAssistantId}
                  onValueChange={setSelectedAssistantId}
                  disabled={isLoadingAssistants}
                >
                  <SelectTrigger id="assistant" className="w-full">
                    <SelectValue placeholder="Select an assistant" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingAssistants ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading assistants...</span>
                      </div>
                    ) : (
                      assistants.map((assistant) => (
                        <SelectItem key={assistant.id} value={assistant.id}>
                          {assistant.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Select a pre-configured assistant or create a new one
                </p>
              </div>

              {/* Voice Selection */}
              <div className="flex-shrink-0 space-y-2">
                <Label>Voice Selection</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {isLoadingVoices ? (
                    <div className="col-span-2 flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Loading voices...</span>
                    </div>
                  ) : (
                    voices.map((voice) => (
                      <Card 
                        key={voice.id} 
                        className={`cursor-pointer ${
                          selectedVoiceId === voice.id ? "border-2 border-primary" : ""
                        }`}
                        onClick={() => setSelectedVoiceId(voice.id)}
                      >
                        <CardHeader className="p-4 pb-0">
                          <div className="flex justify-between items-center">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={voice.imageUrl} alt={voice.name} />
                              <AvatarFallback>{voice.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlayPreview(voice.id);
                              }}
                            >
                              {isPlaying && selectedVoiceId === voice.id ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <CardTitle className="text-base">{voice.name}</CardTitle>
                          <CardDescription>
                            {voice.accent} {voice.gender}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              {/* System Prompt */}
              <div className="flex-shrink-0 space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter instructions for the AI assistant..."
                  className="min-h-[120px]"
                />
                <p className="text-sm text-muted-foreground">
                  Provide clear instructions for how the assistant should behave during the call
                </p>
              </div>

              {/* Phone Number Selection */}
              <div className="flex-shrink-0 space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Select
                  value={selectedPhoneNumberId}
                  onValueChange={setSelectedPhoneNumberId}
                  disabled={isLoadingPhoneNumbers}
                >
                  <SelectTrigger id="phoneNumber" className="w-full">
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingPhoneNumbers ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading phone numbers...</span>
                      </div>
                    ) : (
                      phoneNumbers.map((phoneNumber) => (
                        <SelectItem key={phoneNumber.id} value={phoneNumber.id}>
                          {phoneNumber.friendlyName ? `${phoneNumber.friendlyName} (${phoneNumber.phoneNumber})` : phoneNumber.phoneNumber}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Select the phone number to use for outbound calls
                </p>
              </div>

              {/* Voicemail Settings */}
              <div className="flex-shrink-0 space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Leave Voicemail</Label>
                    <div className="text-sm text-muted-foreground">
                      Enable to leave a voicemail if the contact doesn't answer
                    </div>
                  </div>
                  <Switch
                    checked={leaveVoicemail}
                    onCheckedChange={setLeaveVoicemail}
                  />
                </div>

                {leaveVoicemail && (
                  <div className="space-y-2">
                    <Label htmlFor="voicemailText">Voicemail Message</Label>
                    <Textarea
                      id="voicemailText"
                      value={voicemailText}
                      onChange={(e) => setVoicemailText(e.target.value)}
                      placeholder="Enter the message to leave as voicemail..."
                      className="min-h-[100px]"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="flex-shrink-0 space-y-2">
                <Label htmlFor="note">Add Note</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a description, purpose or goal for this call step"
                  className="min-h-[80px]"
                />
              </div>
            </div>

            {/* Right column - Preview */}
            <div className="flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 bg-muted/30">
                <div className="p-4 bg-white rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Call Configuration Preview</h3>
                  
                  {/* Assistant Preview */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Assistant</h4>
                    <div className="p-3 bg-muted/20 rounded-md">
                      {getSelectedAssistant() ? (
                        <>
                          <p className="font-medium">{getSelectedAssistant()?.name}</p>
                          <p className="text-sm text-muted-foreground">{getSelectedAssistant()?.description}</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No assistant selected</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Voice Preview */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Voice</h4>
                    <div className="p-3 bg-muted/20 rounded-md">
                      {getSelectedVoice() ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={getSelectedVoice()?.imageUrl} alt={getSelectedVoice()?.name} />
                            <AvatarFallback>{getSelectedVoice()?.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{getSelectedVoice()?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {getSelectedVoice()?.accent} {getSelectedVoice()?.gender}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No voice selected</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Phone Number Preview */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Phone Number</h4>
                    <div className="p-3 bg-muted/20 rounded-md flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {getSelectedPhoneNumber() ? (
                        <p>{getSelectedPhoneNumber()?.phoneNumber}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No phone number selected</p>
                      )}
                    </div>
                  </div>
                  
                  {/* System Prompt Preview */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">System Prompt</h4>
                    <div className="p-3 bg-muted/20 rounded-md">
                      {systemPrompt ? (
                        <p className="text-sm whitespace-pre-wrap">{systemPrompt}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No system prompt provided</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Voicemail Preview */}
                  {leaveVoicemail && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Voicemail Message</h4>
                      <div className="p-3 bg-muted/20 rounded-md">
                        {voicemailText ? (
                          <p className="text-sm whitespace-pre-wrap">{voicemailText}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No voicemail message provided</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-between items-center pt-4 mt-4 border-t">
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 hover:bg-muted rounded-sm cursor-help">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px]">
                    <p className="text-sm">
                      This call configuration will be used when this step runs in your sequence.
                      The assistant will call your contacts using the selected voice and phone number.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
