import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, Trash } from 'lucide-react';
import { JobDescription } from '@/types/interview';
import { formatDistanceToNow } from 'date-fns';

export function JobDescriptionList() {
  // This would be fetched from your backend in a real application
  const [jobDescriptions] = useState<JobDescription[]>([
    {
      id: '1',
      user_id: '1',
      source_type: 'manual',
      raw_text: 'Frontend Developer position...',
      parsed_fields: {
        role_title: 'Frontend Developer',
        responsibilities: ['Build user interfaces', 'Optimize performance'],
        required_qualifications: ['React', 'TypeScript'],
        preferred_qualifications: ['Next.js', 'Testing'],
        technical_keywords: ['React', 'TypeScript', 'Next.js'],
      },
      created_at: '2024-03-20T10:00:00Z',
    },
  ]);

  const handleDelete = async (id: string) => {
    // Implement delete functionality
    console.log('Delete job description:', id);
  };

  const handleGenerateStudyGuide = async (id: string) => {
    // Implement study guide generation
    console.log('Generate study guide for:', id);
  };

  if (jobDescriptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Job Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add a job description to get started with your interview preparation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Added</TableHead>
          <TableHead>Keywords</TableHead>
          <TableHead className="w-[70px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobDescriptions.map((jd) => (
          <TableRow key={jd.id}>
            <TableCell className="font-medium">{jd.parsed_fields.role_title}</TableCell>
            <TableCell>{jd.source_type}</TableCell>
            <TableCell>
              {formatDistanceToNow(new Date(jd.created_at), { addSuffix: true })}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {jd.parsed_fields.technical_keywords?.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10"
                  >
                    {keyword}
                  </span>
                ))}
                {(jd.parsed_fields.technical_keywords?.length || 0) > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{(jd.parsed_fields.technical_keywords?.length || 0) - 3} more
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleGenerateStudyGuide(jd.id)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Study Guide
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(jd.id)}
                    className="text-destructive"
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 