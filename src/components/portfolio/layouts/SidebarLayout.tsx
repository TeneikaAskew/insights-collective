
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Github, Linkedin, Mail, MapPin } from 'lucide-react';

interface SidebarLayoutProps {
  portfolioPage: PortfolioPage;
}

export function SidebarLayout({ portfolioPage }: SidebarLayoutProps) {
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
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div className="w-1/3 bg-gradient-to-b from-blue-600 to-purple-600 text-white p-8 flex flex-col">
        <div className="text-center mb-8">
          {profileData?.avatar_url && (
            <img
              src={profileData.avatar_url}
              alt="Profile"
              className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-white shadow-lg"
            />
          )}
          <h1 className="text-3xl font-bold mb-2">{portfolioPage.title}</h1>
          <p className="text-lg opacity-90">{portfolioPage.description}</p>
        </div>

        {profileData?.professional_summary && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">About</h3>
            <p className="text-sm leading-relaxed opacity-90">{profileData.professional_summary}</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {profileData?.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{profileData.location}</span>
            </div>
          )}
          {profileData?.github_url && (
            <a
              href={profileData.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-gray-200 transition-colors"
            >
              <Github className="h-4 w-4" />
              <span className="text-sm">GitHub</span>
            </a>
          )}
          {profileData?.linkedin_url && (
            <a
              href={profileData.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-gray-200 transition-colors"
            >
              <Linkedin className="h-4 w-4" />
              <span className="text-sm">LinkedIn</span>
            </a>
          )}
        </div>

        {profileData?.skills && profileData.skills.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profileData.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profileData?.email && (
          <div className="mt-auto">
            <Button variant="secondary" className="w-full bg-white text-blue-600 hover:bg-gray-100">
              <Mail className="h-4 w-4 mr-2" />
              Contact Me
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Experience Section */}
        {profileData?.experience && profileData.experience.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Experience</h2>
            <div className="space-y-6">
              {profileData.experience.map((exp) => (
                <div key={exp.id} className="border-l-4 border-blue-500 pl-6 pb-6">
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
          </section>
        )}

        {/* Education Section */}
        {profileData?.education && profileData.education.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Education</h2>
            <div className="space-y-6">
              {profileData.education.map((edu) => (
                <div key={edu.id} className="border-l-4 border-purple-500 pl-6 pb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">{edu.degree}</h3>
                      <p className="text-lg text-purple-600 font-medium">{edu.institution}</p>
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {edu.graduationYear}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects Section */}
        <section>
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Projects</h2>
          {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
            <div className="grid gap-6">
              {portfolioPage.projects.map((projectItem) => {
                const project = projectItem.project;
                if (!project) return null;

                return (
                  <div key={projectItem.id} className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">{project.title}</h3>
                    <p className="text-gray-600 mb-4">
                      {projectItem.custom_description || project.description}
                    </p>
                    
                    {project.required_skills && project.required_skills.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Technologies Used:</h4>
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
            <div className="text-center py-12 text-gray-500">
              <p>No projects to showcase yet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
