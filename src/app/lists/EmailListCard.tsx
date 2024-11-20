import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Users, Tag } from "lucide-react";
import { EmailList } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

interface EmailListCardProps {
  list: EmailList;
  onEdit?: (list: EmailList) => void;
  onDelete?: (list: EmailList) => void;
  onDuplicate?: (list: EmailList) => void;
  onView?: (list: EmailList) => void;
}

export const EmailListCard = ({
  list,
  onEdit,
  onDelete,
  onDuplicate,
  onView,
}: EmailListCardProps) => {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{list.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(list)}>
                Edit List
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate?.(list)}>
                Duplicate List
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(list)}
                className="text-destructive"
              >
                Delete List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {list.description && (
          <CardDescription>{list.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            <span>{list.contacts.length} contacts</span>
          </div>
          {list.tags && list.tags.length > 0 && (
            <div className="flex items-center">
              <Tag className="h-4 w-4 mr-1" />
              <span>{list.tags.length} tags</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(`/lists/${list.id}`)}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};
