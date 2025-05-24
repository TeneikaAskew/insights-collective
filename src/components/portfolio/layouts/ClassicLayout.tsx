
import React from 'react';
import { PortfolioPage } from '@/types/portfolio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Github, Linkedin, Mail, MapPin } from 'lucide-react';

interface ClassicLayoutProps {
  portfolioPage: PortfolioPage;
}

export function ClassicLayout({ portfolioPage }: ClassicLayoutProps) {
  const profileData = portfolioPage.profile_data;

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate) return '';
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        // Handle YYYY-MM format
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
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-6 mb-6">
            {profileData?.avatar_url && (
              <img
                src={profileData.avatar_url}
                alt="Profile"
                className="w-20 h-20 rounded-full border-4 border-white shadow-lg"
              />
            )}
            <div>
              <h1 className="text-4xl font-bold mb-2">{portfolioPage.title}</h1>
              <p className="text-xl opacity-90">{portfolioPage.description}</p>
            </div>
          </div>

          {profileData?.professional_summary && (
            <p className="text-lg mb-6 max-w-3xl">{profileData.professional_summary}</p>
          )}

          <div className="flex flex-wrap gap-4 mb-6">
            {profileData?.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span>{profileData.location}</span>
              </div>
            )}
            {profileData?.github_url && (
              <a
                href={profileData.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-gray-200 transition-colors"
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
                className="flex items-center gap-2 hover:text-gray-200 transition-colors"
              >
                <Linkedin className="h-5 w-5" />
                <span>LinkedIn</span>
              </a>
            )}
          </div>

          {profileData?.email && (
            <Button variant="secondary" className="bg-white text-purple-600 hover:bg-gray-100">
              <Mail className="h-4 w-4 mr-2" />
              Hire Me
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Skills Section */}
        {profileData?.skills && profileData.skills.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Skills & Technologies</h2>
            <div className="flex flex-wrap gap-3">
              {profileData.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-sm py-2 px-4 bg-purple-100 text-purple-800">
                  {skill}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {/* Experience Section */}
        {profileData?.experience && profileData.experience.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Experience</h2>
            <div className="space-y-6">
              {profileData.experience.map((exp) => (
                <div key={exp.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">{exp.role}</h3>
                      <p className="text-lg text-purple-600 font-medium">{exp.company}</p>
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
                <div key={edu.id} className="bg-white rounded-lg shadow-md p-6">
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
                  <div key={projectItem.id} className="bg-white rounded-lg shadow-md p-6">
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
