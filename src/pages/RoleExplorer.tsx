
import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Industry = {
  id: string;
  name: string;
  domains: Domain[];
};

type Domain = {
  id: string;
  name: string;
  color: string; // Tailwind color class suffix, e.g., "emerald"
  roles: Role[];
};

type Role = {
  id: string;
  title: string;
  shortDescription: string;
  responsibilities: string[];
  technicalSkills: string[];
  businessSkills: string[];
  careerPath: string[];
  salaryRange: string;
  education: string;
};

// Placeholder data (can be expanded later)
const industries: Industry[] = [
  {
    id: "finance",
    name: "Finance & Banking",
    domains: [
      {
        id: "ai-ml",
        name: "AI/ML Engineering",
        color: "violet",
        roles: [
          {
            id: "ml-engineer",
            title: "Machine Learning Engineer",
            shortDescription: "Design and deploy ML models in finance applications.",
            responsibilities: [
              "Build scalable ML pipelines",
              "Optimize model performance",
              "Collaborate with data scientists",
            ],
            technicalSkills: [
              "Python",
              "TensorFlow",
              "AWS SageMaker",
              "SQL",
            ],
            businessSkills: [
              "Financial domain knowledge",
              "Project management",
              "Communication",
            ],
            careerPath: [
              "Junior ML Engineer",
              "ML Engineer",
              "Senior ML Engineer",
              "Lead ML Engineer",
            ],
            salaryRange: "$90k - $180k",
            education: "Bachelor's in CS, Math, or related field",
          },
        ],
      },
      {
        id: "data-engineering",
        name: "Data Engineering",
        color: "blue",
        roles: [
          {
            id: "data-engineer",
            title: "Data Engineer",
            shortDescription: "Develop and maintain data pipelines for banking data.",
            responsibilities: [
              "Build ETL workflows",
              "Manage data warehouse",
              "Ensure data quality and compliance",
            ],
            technicalSkills: [
              "Spark",
              "Kafka",
              "SQL",
              "Airflow",
            ],
            businessSkills: [
              "Data governance",
              "Regulatory knowledge",
              "Stakeholder communication",
            ],
            careerPath: [
              "Junior Data Engineer",
              "Data Engineer",
              "Senior Data Engineer",
              "Data Engineering Manager",
            ],
            salaryRange: "$80k - $160k",
            education: "Bachelor's in CS, Information Systems, or related field",
          },
        ],
      },
    ],
  },
  {
    id: "healthcare",
    name: "Healthcare & Life Sciences",
    domains: [
      {
        id: "data-analysis",
        name: "Data Analysis",
        color: "emerald",
        roles: [
          {
            id: "clinical-data-analyst",
            title: "Clinical Data Analyst",
            shortDescription: "Analyze patient data and clinical trials.",
            responsibilities: [
              "Data cleaning and validation",
              "Statistical analysis",
              "Reporting findings to stakeholders",
            ],
            technicalSkills: [
              "R",
              "SAS",
              "SQL",
              "Excel",
            ],
            businessSkills: [
              "Healthcare industry knowledge",
              "Regulatory compliance",
              "Presentation skills",
            ],
            careerPath: [
              "Data Analyst",
              "Senior Data Analyst",
              "Analytics Manager",
            ],
            salaryRange: "$70k - $140k",
            education: "Bachelor's in Statistics, Public Health, or related",
          },
        ],
      },
    ],
  },
];

// Breadcrumb item type
type BreadcrumbItem = {
  label: string;
  level: "industries" | "domains" | "roles" | "details";
  id?: string;
};

const RoleExplorer: React.FC = () => {
  const [currentIndustryId, setCurrentIndustryId] = useState<string | null>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);

  // Helpers for getting current selections
  const currentIndustry = currentIndustryId
    ? industries.find((ind) => ind.id === currentIndustryId) ?? null
    : null;
  const currentDomain = currentIndustry && currentDomainId
    ? currentIndustry.domains.find((dom) => dom.id === currentDomainId) ?? null
    : null;
  const currentRole = currentDomain && currentRoleId
    ? currentDomain.roles.find((role) => role.id === currentRoleId) ?? null
    : null;

  // Breadcrumb trail generation
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Industries", level: "industries" },
  ];
  if (currentIndustry) {
    breadcrumbItems.push({ label: currentIndustry.name, level: "domains", id: currentIndustry.id });
  }
  if (currentDomain) {
    breadcrumbItems.push({ label: currentDomain.name, level: "roles", id: currentDomain.id });
  }
  if (currentRole) {
    breadcrumbItems.push({ label: currentRole.title, level: "details", id: currentRole.id });
  }

  // Handlers for breadcrumb clicks: navigate to level & reset deeper levels
  function handleBreadcrumbClick(level: BreadcrumbItem["level"]) {
    if (level === "industries") {
      setCurrentIndustryId(null);
      setCurrentDomainId(null);
      setCurrentRoleId(null);
    } else if (level === "domains" && currentIndustryId) {
      setCurrentDomainId(null);
      setCurrentRoleId(null);
    } else if (level === "roles") {
      setCurrentRoleId(null);
    }
  }

  // Back button handler: same as breadcrumb except safer for UI
  function handleBack() {
    if (currentRoleId) {
      setCurrentRoleId(null);
    } else if (currentDomainId) {
      setCurrentDomainId(null);
    } else if (currentIndustryId) {
      setCurrentIndustryId(null);
    }
  }

  // Card for clicking on an item (industry/domain/role)
  const ExplorerCard = ({
    title,
    description,
    colorClass = "bg-gray-100",
    onClick,
    children,
  }: {
    title: string;
    description?: string;
    colorClass?: string;
    onClick: () => void;
    children?: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={`focus:outline-none group rounded-lg p-5 shadow-md border border-transparent hover:border-primary transition-colors w-full text-left flex flex-col min-h-[120px] justify-between ${colorClass}`}
      aria-label={`Explore ${title}`}
      type="button"
    >
      <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-3">{description}</p>
      )}
      {children}
    </button>
  );

  // Badge list for skills
  const SkillBadges = ({ skills }: { skills: string[] }) => (
    <div className="flex flex-wrap gap-2 mt-4">
      {skills.map((skill) => (
        <Badge key={skill} variant="outline" className="text-xs cursor-default select-none" aria-label={`Skill: ${skill}`}>
          {skill}
        </Badge>
      ))}
    </div>
  );

  // Role details panel
  const RoleDetails = ({ role }: { role: Role }) => (
    <div className="bg-white shadow-lg rounded-lg p-6 max-w-4xl mx-auto w-full space-y-6 transition-transform animate-enter">
      <h2 className="text-3xl font-bold">{role.title}</h2>
      <p className="text-muted-foreground text-lg">{role.shortDescription}</p>

      <section>
        <h3 className="font-semibold mb-2 text-primary">Core Responsibilities</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          {role.responsibilities.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-primary">Technical Skills</h3>
        <SkillBadges skills={role.technicalSkills} />
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-primary">Business Skills</h3>
        <SkillBadges skills={role.businessSkills} />
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-primary">Career Progression</h3>
        <ol className="list-decimal list-inside text-sm space-y-1">
          {role.careerPath.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-primary">Salary Range</h3>
        <p className="text-sm">{role.salaryRange}</p>
      </section>

      <section>
        <h3 className="font-semibold mb-2 text-primary">Educational Requirements</h3>
        <p className="text-sm">{role.education}</p>
      </section>
    </div>
  );

  // Visual roles list when a role is selected
  // Shows all roles in the selected domain with highlight on selected role

  const RolesList = () => {
    if (!currentDomain) return null;

    return (
      <section aria-label={`All roles in ${currentDomain.name}`} className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {currentDomain.roles.map((role) => {
          const isSelected = role.id === currentRoleId;
          return (
            <ExplorerCard
              key={role.id}
              title={role.title}
              description={role.shortDescription}
              colorClass={isSelected ? `border-4 border-primary bg-${currentDomain.color}-50` : `bg-${currentDomain.color}-50 hover:bg-${currentDomain.color}-100 focus:bg-${currentDomain.color}-200`}
              onClick={() => setCurrentRoleId(role.id)}
            >
              <SkillBadges skills={role.technicalSkills.slice(0, 3)} />
            </ExplorerCard>
          );
        })}
      </section>
    );
  };

  // Main render

  return (
    <main className="max-w-6xl mx-auto p-4 min-h-screen flex flex-col">
      {/* Breadcrumb navigation */}
      <nav aria-label="Breadcrumb" className="mb-4 select-none">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbItems.map((item, idx) => {
            const isLast = idx === breadcrumbItems.length - 1;
            return (
              <li key={idx} className="flex items-center">
                {idx > 0 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" aria-hidden="true" />}
                {isLast ? (
                  <span aria-current="page" className="font-semibold text-primary">{item.label}</span>
                ) : (
                  <button
                    onClick={() => handleBreadcrumbClick(item.level)}
                    className="hover:underline focus:underline focus:outline-none"
                    aria-label={`Go to ${item.label}`}
                    type="button"
                  >
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Back button for hierarchical navigation */}
      {(currentIndustryId || currentDomainId || currentRoleId) && (
        <Button
          variant="ghost"
          className="mb-4 max-w-[110px] flex items-center gap-1"
          onClick={handleBack}
          aria-label="Go back"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      )}

      {!currentIndustryId && (
        // Show industries
        <section aria-label="Industries" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {industries.map((industry) => (
            <ExplorerCard
              key={industry.id}
              title={industry.name}
              colorClass="bg-white hover:bg-primary/10 focus:bg-primary/20"
              onClick={() => setCurrentIndustryId(industry.id)}
            />
          ))}
        </section>
      )}

      {currentIndustry && !currentDomainId && !currentRoleId && (
        // Show domains within the selected industry
        <section aria-label={`Domains in ${currentIndustry.name}`} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {currentIndustry.domains.map((domain) => (
            <ExplorerCard
              key={domain.id}
              title={domain.name}
              colorClass={`bg-${domain.color}-100 hover:bg-${domain.color}-200 focus:bg-${domain.color}-300`}
              onClick={() => setCurrentDomainId(domain.id)}
            >
              <Badge variant="outline" className={`text-${domain.color}-600 border-${domain.color}-600 cursor-default`}>
                {domain.name}
              </Badge>
              <p className="sr-only">{`Explore roles in ${domain.name} domain`}</p>
            </ExplorerCard>
          ))}
        </section>
      )}

      {currentIndustry && currentDomain && !currentRoleId && (
        // Show all roles in the domain visually, letting user select a role to see details
        <RolesList />
      )}

      {currentRole && <RoleDetails role={currentRole} />}

    </main>
  );
};

export default RoleExplorer;
