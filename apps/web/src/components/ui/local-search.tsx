"use client";

import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LocalSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  isLoading?: boolean;
  onSearch?: (value: string) => void;
}

export function LocalSearch({
  className,
  isLoading,
  onSearch,
  ...props
}: LocalSearchProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch?.(props.value as string);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input {...props} type="search" className={cn("w-[300px]", className)} />
      <Button type="submit" variant="outline">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}
