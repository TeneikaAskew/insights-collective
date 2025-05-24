
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Github, Linkedin, Mail, MapPin } from 'lucide-react';

interface GridLayoutProps {
  portfolioPage: PortfolioPage;
}

export function GridLayout({ portfolioPage }: GridLayoutProps) {
  const profileData = portfolioPage.profile_data;

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate) return '';
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const [year, month] = dateStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      } catch {
        return dateStr;
      }
    };

    const start = formatDate(startDate);
    const end = endDate ? formatDate(endDate) : 'Present';
    return `${start} - ${end}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            {profileData?.avatar_url && (
              <img
                src={profileData.avatar_url}
                alt="Profile"
                className="w-24 h-24 rounded-full mx-auto mb-4 shadow-lg"
              />
            )}
            <h1 className="text-4xl font-bold text-gray-800 mb-2">{portfolioPage.title}</h1>
            <p className="text-xl text-gray-600 mb-4">{portfolioPage.description}</p>
            
            {profileData?.professional_summary && (
              <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-6">{profileData.professional_summary}</p>
            )}

            <div className="flex justify-center items-center gap-6 mb-4">
              {profileData?.location && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-5 w-5" />
                  <span>{profileData.location}</span>
                </div>
              )}
              {profileData?.github_url && (
                <a
                  href={profileData.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <Github className="h-5 w-5" />
                  <span>GitHub</span>
                </a>
              )}
              {profileData?.linkedin_url && (
                <a
                  href={profileData.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <Linkedin className="h-5 w-5" />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>

            {profileData?.email && (
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Mail className="h-4 w-4 mr-2" />
                Get In Touch
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Skills */}
            {profileData?.skills && profileData.skills.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {profileData.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {profileData?.education && profileData.education.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Education</h2>
                <div className="space-y-4">
                  {profileData.education.map((edu) => (
                    <div key={edu.id}>
                      <h3 className="text-lg font-semibold text-gray-800">{edu.degree}</h3>
                      <p className="text-blue-600 font-medium">{edu.institution}</p>
                      <p className="text-sm text-gray-500">{edu.graduationYear}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Middle Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Experience */}
            {profileData?.experience && profileData.experience.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Experience</h2>
                <div className="space-y-6">
                  {profileData.experience.map((exp) => (
                    <div key={exp.id} className="border-b border-gray-200 last:border-b-0 pb-6 last:pb-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-800">{exp.role}</h3>
                          <p className="text-lg text-blue-600 font-medium">{exp.company}</p>
                        </div>
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                          {formatDateRange(exp.startDate, exp.endDate)}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-gray-600 leading-relaxed">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Projects</h2>
              {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
                <div className="grid gap-6">
                  {portfolioPage.projects.map((projectItem) => {
                    const project = projectItem.project;
                    if (!project) return null;

                    return (
                      <div key={projectItem.id} className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-xl font-semibold text-gray-800 mb-3">{project.title}</h3>
                        <p className="text-gray-600 mb-4">
                          {projectItem.custom_description || project.description}
                        </p>
                        
                        {project.required_skills && project.required_skills.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Technologies:</h4>
                            <div className="flex flex-wrap gap-2">
                              {project.required_skills.map((skill, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between text-sm text-gray-500">
                          {project.effort_level && (
                            <span>Effort: {project.effort_level}</span>
                          )}
                          {project.impact && (
                            <span>Impact: {project.impact}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No projects to showcase yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
