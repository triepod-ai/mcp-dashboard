import React, { useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme } from "@/hooks/useTheme";

interface ThemeToggleProps {
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
  align?: "start" | "center" | "end";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = "ghost",
  size = "sm",
  showLabel = false,
  align = "end",
}) => {
  const { theme, setTheme, effectiveTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      case "system":
        return <Monitor className="h-4 w-4" />;
      default:
        return effectiveTheme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        );
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "system":
        return "System";
      default:
        return "Theme";
    }
  };

  const handleThemeSelect = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="transition-all duration-200 hover:bg-accent hover:text-accent-foreground"
        >
          {getThemeIcon()}
          {showLabel && <span className="ml-2">{getThemeLabel()}</span>}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 p-2">
        <div className="space-y-1">
          <Button
            variant={theme === "light" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleThemeSelect("light")}
            className="w-full justify-start gap-2"
          >
            <Sun className="h-4 w-4" />
            <span>Light</span>
            {theme === "light" && (
              <span className="ml-auto text-xs text-muted-foreground">
                Current
              </span>
            )}
          </Button>
          <Button
            variant={theme === "dark" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleThemeSelect("dark")}
            className="w-full justify-start gap-2"
          >
            <Moon className="h-4 w-4" />
            <span>Dark</span>
            {theme === "dark" && (
              <span className="ml-auto text-xs text-muted-foreground">
                Current
              </span>
            )}
          </Button>
          <Button
            variant={theme === "system" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleThemeSelect("system")}
            className="w-full justify-start gap-2"
          >
            <Monitor className="h-4 w-4" />
            <span>System</span>
            {theme === "system" && (
              <span className="ml-auto text-xs text-muted-foreground">
                Current
              </span>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
