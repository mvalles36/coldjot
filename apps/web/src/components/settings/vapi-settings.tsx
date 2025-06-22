"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "react-hot-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

// Define schema for form validation
const vapiFormSchema = z.object({
  apiKey: z
    .string()
    .min(10, { message: "API key must be at least 10 characters" })
    .refine((val) => val.trim().length > 0, {
      message: "API key is required",
    }),
  orgId: z.string().min(1, { message: "Organization ID is required" }),
});

type VapiFormValues = z.infer<typeof vapiFormSchema>;

interface VapiConfig {
  id?: string;
  apiKey: string;
  orgId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function VapiSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "none" | "success" | "error"
  >("none");
  const [isConfigured, setIsConfigured] = useState(false);

  // Initialize form
  const form = useForm<VapiFormValues>({
    resolver: zodResolver(vapiFormSchema),
    defaultValues: {
      apiKey: "",
      orgId: "",
    },
  });

  // Load existing configuration on component mount
  useEffect(() => {
    async function loadVapiConfig() {
      try {
        const response = await fetch("/api/vapi/config");
        const data = await response.json();

        if (data.configured && data.config) {
          form.setValue("apiKey", data.config.apiKey);
          form.setValue("orgId", data.config.orgId);
          setIsConfigured(true);
        }
      } catch (error) {
        console.error("Error loading Vapi configuration:", error);
        toast.error("Failed to load Vapi configuration");
      } finally {
        setIsLoading(false);
      }
    }

    loadVapiConfig();
  }, [form]);

  // Test connection with Vapi API
  const testConnection = async (values: VapiFormValues) => {
    setIsTesting(true);
    setConnectionStatus("none");

    try {
      const response = await fetch("/api/vapi/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          testConnection: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setConnectionStatus("success");
        toast.success("Vapi API connection successful!");
      } else {
        setConnectionStatus("error");
        toast.error(
          data.error || "Failed to connect to Vapi API. Please check your credentials."
        );
      }
    } catch (error) {
      console.error("Error testing Vapi connection:", error);
      setConnectionStatus("error");
      toast.error("Failed to test Vapi API connection");
    } finally {
      setIsTesting(false);
    }
  };

  // Save Vapi configuration
  const onSubmit = async (values: VapiFormValues) => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/vapi/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Vapi API configuration saved successfully!");
        setIsConfigured(true);
      } else {
        toast.error(
          data.error || "Failed to save Vapi API configuration"
        );
      }
    } catch (error) {
      console.error("Error saving Vapi configuration:", error);
      toast.error("Failed to save Vapi API configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vapi Voice API Configuration</CardTitle>
          <CardDescription>
            Configure your Vapi API credentials for voice calls
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vapi Voice API Configuration</CardTitle>
        <CardDescription>
          Configure your Vapi API credentials for voice calls. You can find these in your 
          Vapi dashboard under API settings.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private API Key</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Enter your Vapi private API key"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="orgId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter your Vapi organization ID"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Connection Status */}
            {connectionStatus !== "none" && (
              <div
                className={`p-4 rounded-lg flex items-center gap-2 ${
                  connectionStatus === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {connectionStatus === "success" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span>
                  {connectionStatus === "success"
                    ? "Connection successful! Your Vapi API credentials are valid."
                    : "Connection failed. Please check your API key and organization ID."}
                </span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.handleSubmit((values) => testConnection(values))()}
              disabled={isTesting || isSaving || !form.formState.isValid}
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            <Button type="submit" disabled={isSaving || isTesting}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
