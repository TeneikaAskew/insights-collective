
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";

type Industry = {
  id: string;
  name: string;
  domains: Domain[];
};

type Domain = {
  id: string;
  name: string;
  color: string;
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

type BreadcrumbItem = {
  label: string;
  level: "industries" | "domains" | "roles" | "details";
  id?: string;
};

const RoleExplorer: React.FC = () => {
  const [currentIndustryId, setCurrentIndustryId] = useState<string | null>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);

  const currentIndustry = currentIndustryId
    ? industries.find((ind) => ind.id === currentIndustryId) ?? null
    : null;
  const currentDomain = currentIndustry && currentDomainId
    ? currentIndustry.domains.find((dom) => dom.id === currentDomainId) ?? null
    : null;
  const currentRole = currentDomain && currentRoleId
    ? currentDomain.roles.find((role) => role.id === currentRoleId) ?? null
    : null;

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

  function handleBack() {
    if (currentRoleId) {
      setCurrentRoleId(null);
    } else if (currentDomainId) {
      setCurrentDomainId(null);
    } else if (currentIndustryId) {
      setCurrentIndustryId(null);
    }
  }

  /**
   * Advanced Force-Directed Role Graph using D3.js and Framer Motion
   */
  const ForceDirectedRoleGraph = ({
    domain,
    selectedRoleId,
    onSelectRole,
  }: {
    domain: Domain;
    selectedRoleId: string | null;
    onSelectRole: (id: string) => void;
  }) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [nodes, setNodes] = useState(
      domain.roles.map((role) => ({
        id: role.id,
        title: role.title,
        x: Math.random() * 500,
        y: Math.random() * 500,
        fx: null as number | null, // fixed position x (for dragging)
        fy: null as number | null, // fixed position y
      }))
    );
    const [links, setLinks] = useState<{ source: string; target: string }[]>([]);

    // Build links as connections between roles based on career progression paths or simple mesh for demo
    useEffect(() => {
      let newLinks: { source: string; target: string }[] = [];
      // For demo, connect each node to the next to form a "career chain"
      for (let i = 0; i < domain.roles.length - 1; i++) {
        newLinks.push({ source: domain.roles[i].id, target: domain.roles[i + 1].id });
      }
      // Also add some additional links for better connectivity mesh
      if (domain.roles.length > 2) {
        newLinks.push({ source: domain.roles[0].id, target: domain.roles[domain.roles.length - 1].id });
      }
      setLinks(newLinks);
    }, [domain.roles]);

    // Create a D3 force simulation for the nodes and links
    useEffect(() => {
      if (!svgRef.current) return;

      const simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(250, 250))
        .force("link", d3.forceLink(links).id(d => d.id).distance(120).strength(1))
        .force("collision", d3.forceCollide(30))
        .on("tick", () => {
          setNodes(simulation.nodes());
        });

      return () => {
        simulation.stop();
      };
    }, [links]); // Re-run simulation when links change

    // Drag handlers to fix node position
    const dragStarted = (event: any, d: any, simulation: any) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    };
    const dragged = (event: any, d: any) => {
      d.fx = event.x;
      d.fy = event.y;
    };
    const dragEnded = (event: any, d: any, simulation: any) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    };

    // Attach drag behavior to nodes using useEffect for d3 drag
    useEffect(() => {
      if (!svgRef.current) return;

      const simulation = d3.forceSimulation(nodes);

      const drag = d3.drag<SVGCircleElement, typeof nodes[0]>()
        .on("start", (event, d) => dragStarted(event, d, simulation))
        .on("drag", dragged)
        .on("end", (event, d) => dragEnded(event, d, simulation));

      d3.select(svgRef.current).selectAll("circle").call(drag);

      return () => {
        drag.on("start", null).on("drag", null).on("end", null);
      };
    }, [nodes]);

    return (
      <svg
        ref={svgRef}
        width={500}
        height={500}
        role="img"
        aria-label={`Interactive force-directed role graph for domain ${domain.name}`}
        className="mx-auto"
      >
        <AnimatePresence>
          {links.map(({ source, target }) => {
            // Find coords for source and target nodes
            const sourceNode = nodes.find(n => n.id === source);
            const targetNode = nodes.find(n => n.id === target);
            if (!sourceNode || !targetNode) return null;

            return (
              <motion.line
                key={`${source}-${target}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="#cbd5e1"
                strokeWidth={2}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              />
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {nodes.map((node) => {
            const isSelected = node.id === selectedRoleId;
            return (
              <motion.g
                key={node.id}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={node.title}
                className="cursor-pointer"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => onSelectRole(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectRole(node.id);
                  }
                }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 18 : 14}
                  fill={isSelected ? "#4f46e5" : "#93c5fd"}
                  stroke={isSelected ? "#3730a3" : "#2563eb"}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fill={isSelected ? "white" : "#1e40af"}
                  fontWeight={isSelected ? "bold" : "normal"}
                  fontSize={isSelected ? 14 : 11}
                  pointerEvents="none"
                >
                  {node.title.length > 12 ? node.title.slice(0, 11) + "…" : node.title}
                </text>
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
    );
  };

  const SkillBadges = ({ skills }: { skills: string[] }) => (
    <div className="flex flex-wrap gap-2 mt-4">
      {skills.map((skill) => (
        <Badge key={skill} variant="outline" className="text-xs cursor-default select-none" aria-label={`Skill: ${skill}`}>
          {skill}
        </Badge>
      ))}
    </div>
  );

  const RoleDetails = ({ role }: { role: Role }) => (
    <div
      key={role.id}
      className="bg-white shadow-lg rounded-lg p-6 max-w-4xl mx-auto w-full space-y-6 transition-transform duration-300 ease-out animate-enter"
      tabIndex={0}
      aria-live="polite"
      aria-label={`Details about ${role.title}`}
    >
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

  const RolesList = () => {
    if (!currentDomain) return null;
    return (
      <section
        aria-label={`Roles in ${currentDomain.name}`}
        className="mt-6 max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
      >
        {currentDomain.roles.map((role) => {
          const isSelected = role.id === currentRoleId;
          return (
            <button
              key={role.id}
              onClick={() => setCurrentRoleId(role.id)}
              className={`focus:outline-none rounded-lg p-4 shadow-md border border-transparent transition-colors w-full text-left  bg-white ${
                isSelected ? "border-primary ring-2 ring-primary" : "hover:border-primary"
              }`}
              aria-label={`View details for ${role.title}`}
              type="button"
              aria-pressed={isSelected}
            >
              <h4 className="text-lg font-semibold mb-1">{role.title}</h4>
              <p className="text-sm text-muted-foreground">
                {role.shortDescription.length > 80
                  ? role.shortDescription.slice(0, 77) + "…"
                  : role.shortDescription}
              </p>
            </button>
          );
        })}
      </section>
    );
  };

  return (
    <main className="max-w-6xl mx-auto p-4 min-h-screen flex flex-col">
      <nav aria-label="Breadcrumb" className="mb-4 select-none">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbItems.map((item, idx) => {
            const isLast = idx === breadcrumbItems.length - 1;
            return (
              <li key={idx} className="flex items-center">
                {idx > 0 && (
                  <ChevronRight
                    className="w-4 h-4 mx-1 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                {isLast ? (
                  <span
                    aria-current="page"
                    className="font-semibold text-primary"
                  >
                    {item.label}
                  </span>
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
        <section
          aria-label="Industries"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {industries.map((industry) => (
            <button
              key={industry.id}
              onClick={() => setCurrentIndustryId(industry.id)}
              className="focus:outline-none group rounded-lg p-5 shadow-md border border-transparent hover:border-primary transition-colors w-full text-left flex flex-col min-h-[120px] justify-between bg-white hover:bg-primary/10 focus:bg-primary/20"
              aria-label={`Explore ${industry.name}`}
              type="button"
            >
              <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">{industry.name}</h3>
            </button>
          ))}
        </section>
      )}

      {currentIndustry && !currentDomainId && !currentRoleId && (
        <section
          aria-label={`Domains in ${currentIndustry.name}`}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {currentIndustry.domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => setCurrentDomainId(domain.id)}
              className={`focus:outline-none group rounded-lg p-5 shadow-md border border-transparent hover:border-${domain.color}-600 transition-colors w-full text-left flex flex-col min-h-[120px] justify-between bg-${domain.color}-100 hover:bg-${domain.color}-200 focus:bg-${domain.color}-300`}
              aria-label={`Explore ${domain.name}`}
              type="button"
            >
              <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">{domain.name}</h3>
              <Badge
                variant="outline"
                className={`text-${domain.color}-600 border-${domain.color}-600 cursor-default`}
              >
                {domain.name}
              </Badge>
              <p className="sr-only">{`Explore roles in ${domain.name} domain`}</p>
            </button>
          ))}
        </section>
      )}

      {currentIndustry && currentDomain && !currentRoleId && (
        <>
          <ForceDirectedRoleGraph
            domain={currentDomain}
            selectedRoleId={currentRoleId}
            onSelectRole={setCurrentRoleId}
          />
          <RolesList />
        </>
      )}

      {currentRole && <RoleDetails role={currentRole} />}
    </main>
  );
};

export default RoleExplorer;

