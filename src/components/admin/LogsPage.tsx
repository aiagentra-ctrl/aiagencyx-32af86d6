import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebhookLogsTab from "./inbox/WebhookLogsTab";
import ErrorLogTab from "./inbox/ErrorLogTab";
import WebhookUrlCard from "./inbox/WebhookUrlCard";
import WebhookSecretsCard from "./inbox/WebhookSecretsCard";
import PipelineTracer from "./inbox/PipelineTracer";
import { SectionHeader } from "@/components/primitives";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Observability"
        title="Logs & Credentials"
        description="Webhook traffic, pipeline traces, error stream, and integration credentials."
      />
      <Tabs defaultValue="webhook" className="space-y-4">
        <TabsList className="bg-surface-1">
          <TabsTrigger value="webhook">Webhook Logs</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline Events</TabsTrigger>
          <TabsTrigger value="errors">Error Log</TabsTrigger>
          <TabsTrigger value="creds">Credentials</TabsTrigger>
        </TabsList>
        <TabsContent value="webhook"><WebhookLogsTab /></TabsContent>
        <TabsContent value="pipeline">
          <Card>
            <CardHeader><CardTitle className="text-base">Latest pipeline trace</CardTitle>
              <CardDescription>Live per-message trace. Pick a specific message from the Inbox for a targeted view.</CardDescription>
            </CardHeader>
            <CardContent><PipelineTracer /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="errors"><ErrorLogTab /></TabsContent>
        <TabsContent value="creds" className="space-y-4">
          <WebhookUrlCard />
          <WebhookSecretsCard />
          <Card>
            <CardHeader><CardTitle className="text-base">Tracking snippet</CardTitle>
              <CardDescription>Paste this on any demo page to capture opens/clicks.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-md border bg-muted p-3 text-xs font-mono overflow-x-auto">{`<script async src="${window.location.origin}/track.js" data-project="aiagentra"></script>`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}