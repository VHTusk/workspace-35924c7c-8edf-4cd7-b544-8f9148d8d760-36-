import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type MvpDisabledPageProps = {
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
};

export function MvpDisabledPage({
  title,
  description,
  backHref,
  backLabel,
}: MvpDisabledPageProps) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-16">
      <div className="mx-auto flex max-w-2xl items-center justify-center">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
