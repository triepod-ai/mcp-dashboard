import { useState, memo, useMemo, useCallback, useEffect } from "react";
import type { JsonValue } from "@/utils/jsonUtils";
import clsx from "clsx";
import { Copy, CheckCheck, Code2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/useToast";
import { getDataType, tryParseJson } from "@/utils/jsonUtils";
import useCopy from "@/lib/hooks/useCopy";
import { jsonExpansionStore } from "@/utils/jsonExpansionStore";

type ViewMode = 'raw' | 'formatted';

interface JsonViewProps {
  data: unknown;
  name?: string;
  initialExpandDepth?: number;
  className?: string;
  withCopyButton?: boolean;
  isError?: boolean;
  defaultViewMode?: ViewMode;
  showViewToggle?: boolean;
  instanceId?: string; // Unique identifier for this JsonView instance
}

const JsonView = memo(
  ({
    data,
    name,
    initialExpandDepth = 3,
    className,
    withCopyButton = true,
    isError = false,
    defaultViewMode = 'raw',
    showViewToggle = true,
    instanceId = 'default',
  }: JsonViewProps) => {
    const { toast } = useToast();
    const { copied, setCopied } = useCopy();
    const [, setForceRender] = useState({});

    // Force re-render function
    const triggerRender = useCallback(() => {
      setForceRender({});
    }, []);

    // Get view mode from global store
    const currentViewMode = jsonExpansionStore.getViewMode(instanceId, defaultViewMode);

    // Handle view mode change
    const handleViewModeChange = useCallback((newViewMode: ViewMode) => {
      jsonExpansionStore.setViewMode(instanceId, newViewMode);
      triggerRender(); // Force re-render to reflect the change
    }, [instanceId, triggerRender]);

    // Debug logging
    useEffect(() => {
      console.log(`[JsonView] Component rendered, instanceId: ${instanceId}`);
      console.log(`[JsonView] Data changed:`, data);
      console.log(`[JsonView] Current expansion state:`, jsonExpansionStore.getExpansionState(instanceId));
    });

    const normalizedData = useMemo(() => {
      return typeof data === "string"
        ? tryParseJson(data).success
          ? tryParseJson(data).data
          : data
        : data;
    }, [data]);

    const handleCopy = useCallback(() => {
      try {
        navigator.clipboard.writeText(
          typeof normalizedData === "string"
            ? normalizedData
            : JSON.stringify(normalizedData, null, 2),
        );
        setCopied(true);
      } catch (error) {
        toast({
          title: "Error",
          description: `There was an error coping result into the clipboard: ${error instanceof Error ? error.message : String(error)}`,
          variant: "destructive",
        });
      }
    }, [toast, normalizedData, setCopied]);

    return (
      <div className={clsx("p-4 border rounded relative", className)}>
        <div className="flex items-center gap-2 absolute top-2 right-2">
          {showViewToggle && (
            <div className="flex items-center rounded-md border bg-background">
              <Button
                size="sm"
                variant={currentViewMode === 'raw' ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => handleViewModeChange('raw')}
              >
                <Code2 className="size-3 mr-1" />
                Raw
              </Button>
              <Button
                size="sm"
                variant={currentViewMode === 'formatted' ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => handleViewModeChange('formatted')}
              >
                <FileText className="size-3 mr-1" />
                Formatted
              </Button>
            </div>
          )}
          {withCopyButton && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {copied ? (
                <CheckCheck className="size-3 dark:text-green-700 text-green-600" />
              ) : (
                <Copy className="size-3 text-foreground" />
              )}
            </Button>
          )}
        </div>
        <div className={clsx(
          "text-sm transition-all duration-300 mt-4",
          currentViewMode === 'raw' ? 'font-mono' : 'font-sans'
        )}>
          {currentViewMode === 'raw' ? (
            <JsonNode
              data={normalizedData as JsonValue}
              name={name}
              depth={0}
              initialExpandDepth={initialExpandDepth}
              isError={isError}
              instanceId={instanceId}
              onToggleExpansion={triggerRender}
              nodePath=""
            />
          ) : (
            <FormattedView
              data={normalizedData as JsonValue}
              isError={isError}
              instanceId={instanceId}
              onToggleExpansion={triggerRender}
            />
          )}
        </div>
      </div>
    );
  },
);

JsonView.displayName = "JsonView";

interface JsonNodeProps {
  data: JsonValue;
  name?: string;
  depth: number;
  initialExpandDepth: number;
  isError?: boolean;
  instanceId: string;
  onToggleExpansion: () => void;
  nodePath: string;
}

const JsonNode = memo(
  ({
    data,
    name,
    depth = 0,
    initialExpandDepth,
    isError = false,
    instanceId,
    onToggleExpansion,
    nodePath,
  }: JsonNodeProps) => {
    const currentState = jsonExpansionStore.getExpansionState(instanceId);
    const isExpanded = currentState[nodePath] ?? (depth < initialExpandDepth);

    const toggleExpansion = () => {
      console.log(`[JsonNode] Toggling expansion for ${instanceId}/${nodePath}, current: ${isExpanded}`);
      const newExpanded = jsonExpansionStore.toggleNodeExpansion(instanceId, nodePath, depth < initialExpandDepth);
      console.log(`[JsonNode] New expansion state: ${newExpanded}`);
      onToggleExpansion(); // Trigger re-render of parent component
    };
    const [typeStyleMap] = useState<Record<string, string>>({
      number: "text-blue-600",
      boolean: "text-amber-600",
      null: "text-purple-600",
      undefined: "text-gray-600",
      string: "text-green-600 group-hover:text-green-500",
      error: "text-red-600 group-hover:text-red-500",
      default: "text-gray-700",
    });
    const dataType = getDataType(data);

    const renderCollapsible = (isArray: boolean) => {
      const items = isArray
        ? (data as JsonValue[])
        : Object.entries(data as Record<string, JsonValue>);
      const itemCount = items.length;
      const isEmpty = itemCount === 0;

      const symbolMap = {
        open: isArray ? "[" : "{",
        close: isArray ? "]" : "}",
        collapsed: isArray ? "[ ... ]" : "{ ... }",
        empty: isArray ? "[]" : "{}",
      };

      if (isEmpty) {
        return (
          <div className="flex items-center">
            {name && (
              <span className="mr-1 text-gray-600 dark:text-gray-400">
                {name}:
              </span>
            )}
            <span className="text-gray-500">{symbolMap.empty}</span>
          </div>
        );
      }

      return (
        <div className="flex flex-col">
          <div
            className="flex items-center mr-1 rounded cursor-pointer group hover:bg-gray-800/10 dark:hover:bg-gray-800/20"
            onClick={toggleExpansion}
          >
            {name && (
              <span className="mr-1 text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-100 group-hover:text-gray-400">
                {name}:
              </span>
            )}
            {isExpanded ? (
              <span className="text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-100 group-hover:text-gray-400">
                {symbolMap.open}
              </span>
            ) : (
              <>
                <span className="text-gray-600 dark:group-hover:text-gray-100 group-hover:text-gray-400">
                  {symbolMap.collapsed}
                </span>
                <span className="ml-1 text-gray-700 dark:group-hover:text-gray-100 group-hover:text-gray-400">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </>
            )}
          </div>
          {isExpanded && (
            <>
              <div className="pl-2 ml-4 border-l border-gray-200 dark:border-gray-800">
                {isArray
                  ? (items as JsonValue[]).map((item, index) => (
                      <div key={index} className="my-1">
                        <JsonNode
                          data={item}
                          name={`${index}`}
                          depth={depth + 1}
                          initialExpandDepth={initialExpandDepth}
                          instanceId={instanceId}
                          onToggleExpansion={onToggleExpansion}
                          nodePath={`${nodePath}[${index}]`}
                        />
                      </div>
                    ))
                  : (items as [string, JsonValue][]).map(([key, value]) => (
                      <div key={key} className="my-1">
                        <JsonNode
                          data={value}
                          name={key}
                          depth={depth + 1}
                          initialExpandDepth={initialExpandDepth}
                          instanceId={instanceId}
                          onToggleExpansion={onToggleExpansion}
                          nodePath={`${nodePath}.${key}`}
                        />
                      </div>
                    ))}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {symbolMap.close}
              </div>
            </>
          )}
        </div>
      );
    };

    const renderString = (value: string) => {
      const maxLength = 100;
      const isTooLong = value.length > maxLength;

      if (!isTooLong) {
        return (
          <div className="flex mr-1 rounded hover:bg-gray-800/20">
            {name && (
              <span className="mr-1 text-gray-600 dark:text-gray-400">
                {name}:
              </span>
            )}
            <pre
              className={clsx(
                isError ? typeStyleMap.error : typeStyleMap.string,
                "break-all whitespace-pre-wrap",
              )}
            >
              "{value}"
            </pre>
          </div>
        );
      }

      return (
        <div className="flex mr-1 rounded group hover:bg-gray-800/20">
          {name && (
            <span className="mr-1 text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-100 group-hover:text-gray-400">
              {name}:
            </span>
          )}
          <pre
            className={clsx(
              isError ? typeStyleMap.error : typeStyleMap.string,
              "cursor-pointer break-all whitespace-pre-wrap",
            )}
            onClick={toggleExpansion}
            title={isExpanded ? "Click to collapse" : "Click to expand"}
          >
            {isExpanded ? `"${value}"` : `"${value.slice(0, maxLength)}..."`}
          </pre>
        </div>
      );
    };

    switch (dataType) {
      case "object":
      case "array":
        return renderCollapsible(dataType === "array");
      case "string":
        return renderString(data as string);
      default:
        return (
          <div className="flex items-center mr-1 rounded hover:bg-gray-800/20">
            {name && (
              <span className="mr-1 text-gray-600 dark:text-gray-400">
                {name}:
              </span>
            )}
            <span className={typeStyleMap[dataType] || typeStyleMap.default}>
              {data === null ? "null" : String(data)}
            </span>
          </div>
        );
    }
  },
);

JsonNode.displayName = "JsonNode";

// FormattedView component for human-readable display
interface FormattedViewProps {
  data: JsonValue;
  isError?: boolean;
  instanceId: string;
  onToggleExpansion: () => void;
}

const FormattedView = memo(({ data, isError, instanceId, onToggleExpansion }: FormattedViewProps) => {
  // Use global store for text expansion state in formatted view
  const getExpandedState = (path: string): boolean => {
    const currentState = jsonExpansionStore.getExpansionState(`${instanceId}-formatted`);
    return currentState[path] || false;
  };

  const toggleTextExpansion = (path: string) => {
    jsonExpansionStore.toggleNodeExpansion(`${instanceId}-formatted`, path, false);
    onToggleExpansion(); // Trigger re-render
  };

  const formatValue = (value: JsonValue, path: string = ""): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">Not provided</span>;
    }

    if (typeof value === 'boolean') {
      return <span className={value ? "text-green-600" : "text-red-600"}>{value ? 'Yes' : 'No'}</span>;
    }

    if (typeof value === 'string') {
      // Handle URLs
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return (
          <a href={value} target="_blank" rel="noopener noreferrer"
             className="text-blue-600 hover:text-blue-800 underline">
            {value}
          </a>
        );
      }
      // Handle long text with controlled expansion using global store
      if (value.length > 100) {
        const isExpanded = getExpandedState(path);

        return (
          <div>
            {isExpanded ? (
              // When expanded, show static text with collapse option, no hover effects
              <div className="space-y-2">
                <button
                  className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer underline"
                  onClick={() => toggleTextExpansion(path)}
                >
                  Click to collapse
                </button>
                <div
                  className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm whitespace-pre-wrap cursor-pointer"
                  onDoubleClick={() => toggleTextExpansion(path)}
                  title="Double-click to collapse"
                >
                  {value}
                </div>
              </div>
            ) : (
              // When collapsed, show truncated text with hover title for preview
              <button
                className="text-gray-700 hover:text-gray-900 cursor-pointer text-left"
                onClick={() => toggleTextExpansion(path)}
                title={value} // Only show hover tooltip when collapsed
              >
                {`${value.slice(0, 100)}... (click to expand)`}
              </button>
            )}
          </div>
        );
      }
      return <span className={isError ? "text-red-600" : "text-gray-800 dark:text-gray-200"}>{value}</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-blue-600 font-medium">{value.toLocaleString()}</span>;
    }

    return <span className="text-gray-600">{String(value)}</span>;
  };

  const formatKey = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capitals
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/_/g, ' '); // Replace underscores with spaces
  };

  const renderObject = (obj: Record<string, JsonValue>, level = 0, path = "") => {
    const entries = Object.entries(obj);
    const importantKeys = ['name', 'title', 'description', 'status', 'type', 'success', 'error', 'message'];
    const sortedEntries = entries.sort(([a], [b]) => {
      const aImportant = importantKeys.includes(a.toLowerCase());
      const bImportant = importantKeys.includes(b.toLowerCase());
      if (aImportant && !bImportant) return -1;
      if (!aImportant && bImportant) return 1;
      return a.localeCompare(b);
    });

    return (
      <div className={level > 0 ? "ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4" : ""}>
        {sortedEntries.map(([key, value]) => (
          <div key={key} className="mb-3">
            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
              <div className="flex-shrink-0 w-full sm:w-32">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {formatKey(key)}:
                </span>
              </div>
              <div className="flex-1 min-w-0">
                {Array.isArray(value) ? (
                  renderArray(value, level + 1, `${path}.${key}`)
                ) : value && typeof value === 'object' ? (
                  renderObject(value as Record<string, JsonValue>, level + 1, `${path}.${key}`)
                ) : (
                  <div className="break-words">
                    {formatValue(value, `${path}.${key}`)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderArray = (arr: JsonValue[], level = 0, path = "") => {
    if (arr.length === 0) {
      return <span className="text-gray-500 italic">Empty list</span>;
    }

    return (
      <div className={level > 0 ? "space-y-2" : ""}>
        {arr.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="flex-shrink-0 text-xs text-gray-500 mt-1">
              {index + 1}.
            </span>
            <div className="flex-1 min-w-0">
              {Array.isArray(item) ? (
                renderArray(item, level + 1, `${path}[${index}]`)
              ) : item && typeof item === 'object' ? (
                renderObject(item as Record<string, JsonValue>, level + 1, `${path}[${index}]`)
              ) : (
                <div className="break-words">
                  {formatValue(item, `${path}[${index}]`)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (Array.isArray(data)) {
    return <div className="space-y-2">{renderArray(data, 0, "root")}</div>;
  }

  if (data && typeof data === 'object') {
    return renderObject(data as Record<string, JsonValue>, 0, "root");
  }

  return <div>{formatValue(data, "root")}</div>;
});

FormattedView.displayName = "FormattedView";

export default JsonView;
