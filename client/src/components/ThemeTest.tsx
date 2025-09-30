import React from "react";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Theme Test Component - Used for validating dark mode implementation
 * This component showcases all the key UI elements in both light and dark themes
 */
export const ThemeTest: React.FC = () => {
  const { theme, effectiveTheme } = useTheme();

  return (
    <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Dark Mode Test</h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline">Current: {theme}</Badge>
          <Badge variant="secondary">Effective: {effectiveTheme}</Badge>
          <ThemeToggle showLabel />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Primary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Primary Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button>Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
          </CardContent>
        </Card>

        {/* Status Indicators */}
        <Card>
          <CardHeader>
            <CardTitle>Status Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 dark:bg-green-400" />
              <span>Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 dark:bg-red-400" />
              <span>Disconnected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 dark:bg-yellow-400" />
              <span>Warning</span>
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-x-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Error</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <div className="space-x-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Success
              </Badge>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Info
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Bars</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Memory Usage</div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: "65%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">65% of 512 MB</p>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2 text-sm border-l-2 border-primary/20 bg-accent/30 rounded hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Connection</span>
                <span className="text-muted-foreground">Server connected successfully</span>
              </div>
            </div>
            <div className="p-2 text-sm border-l-2 border-primary/20 bg-accent/30 rounded hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Update</span>
                <span className="text-muted-foreground">Configuration updated</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color Palette */}
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="h-8 w-8 bg-background border border-border rounded"></div>
              <div className="h-8 w-8 bg-foreground rounded"></div>
              <div className="h-8 w-8 bg-card border border-border rounded"></div>
              <div className="h-8 w-8 bg-primary rounded"></div>
              <div className="h-8 w-8 bg-secondary rounded"></div>
              <div className="h-8 w-8 bg-muted rounded"></div>
              <div className="h-8 w-8 bg-accent rounded"></div>
              <div className="h-8 w-8 bg-destructive rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Theme Information */}
      <Card>
        <CardHeader>
          <CardTitle>Theme Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-foreground">Current Theme</h4>
              <p className="text-muted-foreground">{theme}</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Effective Theme</h4>
              <p className="text-muted-foreground">{effectiveTheme}</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">System Preference</h4>
              <p className="text-muted-foreground">
                {window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light"}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground">Storage Key</h4>
              <p className="text-muted-foreground">mcp-dashboard-theme</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};