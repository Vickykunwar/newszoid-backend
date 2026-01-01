// utils/hardcodedData.js - PRODUCTION READY with ALL categories
const HARDCODED_DATA = {
    news: {
        general: [
            {
                id: 'fallback_gen_1',
                title: "Breaking: Major Policy Announcement Expected",
                snippet: "Government officials hint at significant policy changes in upcoming session.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Breaking+News",
                publishedAt: new Date().toISOString(),
                source: "Newszoid",
                category: "general"
            },
            {
                id: 'fallback_gen_2',
                title: "Technology Sector Shows Strong Growth",
                snippet: "Tech companies report record revenues as digital transformation accelerates.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Tech+Growth",
                publishedAt: new Date().toISOString(),
                source: "Newszoid",
                category: "general"
            }
        ],

        india: [
            {
                id: 'fallback_in_1',
                title: "Supreme Court Reviews Constitutional Amendments",
                snippet: "The Supreme Court of India examines petitions challenging recent constitutional changes.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Supreme+Court",
                publishedAt: new Date().toISOString(),
                source: "Newszoid India",
                category: "india"
            },
            {
                id: 'fallback_in_2',
                title: "Parliament Passes Digital Privacy Bill",
                snippet: "Landmark legislation aims to protect citizen data rights in digital age.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Parliament",
                publishedAt: new Date().toISOString(),
                source: "Newszoid India",
                category: "india"
            },
            {
                id: 'fallback_in_3',
                title: "Infrastructure Development Gets Major Boost",
                snippet: "Government announces new funding for roads, railways, and urban infrastructure.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Infrastructure",
                publishedAt: new Date().toISOString(),
                source: "Newszoid India",
                category: "india"
            }
        ],

        world: [
            {
                id: 'fallback_world_1',
                title: "Climate Summit Reaches Historic Agreement",
                snippet: "Global leaders commit to new climate fund and emission reduction targets.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Climate+Summit",
                publishedAt: new Date().toISOString(),
                source: "Global News",
                category: "world"
            },
            {
                id: 'fallback_world_2',
                title: "International Trade Agreements Signed",
                snippet: "Major economies finalize new trade partnerships to boost economic cooperation.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Trade",
                publishedAt: new Date().toISOString(),
                source: "Global News",
                category: "world"
            }
        ],

        business: [
            {
                id: 'fallback_biz_1',
                title: "Stock Markets Hit Record Highs",
                snippet: "Major indices surge as investor confidence strengthens amid positive earnings.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Stock+Market",
                publishedAt: new Date().toISOString(),
                source: "Newszoid Business",
                category: "business"
            },
            {
                id: 'fallback_biz_2',
                title: "Startup Ecosystem Attracts Record Investment",
                snippet: "Venture capital funding reaches new heights in technology and innovation sectors.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Startups",
                publishedAt: new Date().toISOString(),
                source: "Newszoid Business",
                category: "business"
            }
        ],

        technology: [
            {
                id: 'fallback_tech_1',
                title: "AI Revolution Transforms Industries",
                snippet: "Artificial intelligence adoption accelerates across healthcare, finance, and manufacturing.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=AI",
                publishedAt: new Date().toISOString(),
                source: "Tech Daily",
                category: "technology"
            },
            {
                id: 'fallback_tech_2',
                title: "Quantum Computing Breakthrough Announced",
                snippet: "Research teams achieve major milestone in quantum processor development.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Quantum",
                publishedAt: new Date().toISOString(),
                source: "Tech Daily",
                category: "technology"
            }
        ],

        sports: [
            {
                id: 'fallback_sport_1',
                title: "Cricket World Cup Final Approaches",
                snippet: "Teams prepare for high-stakes championship match as fans worldwide anticipate.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Cricket",
                publishedAt: new Date().toISOString(),
                source: "Sports Today",
                category: "sports"
            },
            {
                id: 'fallback_sport_2',
                title: "Olympic Athletes Break Records",
                snippet: "Multiple world records fall as competition intensifies at international games.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Olympics",
                publishedAt: new Date().toISOString(),
                source: "Sports Today",
                category: "sports"
            }
        ],

        environment: [
            {
                id: 'fallback_env_1',
                title: "Renewable Energy Costs Continue to Drop",
                snippet: "Solar and wind power become most economical electricity sources globally.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Renewable+Energy",
                publishedAt: new Date().toISOString(),
                source: "EcoWorld",
                category: "environment"
            },
            {
                id: 'fallback_env_2',
                title: "Forest Conservation Efforts Expand",
                snippet: "New initiatives aim to protect biodiversity and combat deforestation.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Forest",
                publishedAt: new Date().toISOString(),
                source: "EcoWorld",
                category: "environment"
            }
        ],

        education: [
            {
                id: 'fallback_edu_1',
                title: "Education Reform Focuses on Digital Skills",
                snippet: "Curriculum updates emphasize technology literacy and critical thinking.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Education",
                publishedAt: new Date().toISOString(),
                source: "Education Today",
                category: "education"
            },
            {
                id: 'fallback_edu_2',
                title: "Universities Launch New Research Programs",
                snippet: "Academic institutions expand offerings in emerging fields and interdisciplinary studies.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=University",
                publishedAt: new Date().toISOString(),
                source: "Education Today",
                category: "education"
            }
        ],

        health: [
            {
                id: 'fallback_health_1',
                title: "Medical Breakthrough in Cancer Treatment",
                snippet: "New therapy shows promising results in clinical trials for multiple cancer types.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Medical+Research",
                publishedAt: new Date().toISOString(),
                source: "Health News",
                category: "health"
            },
            {
                id: 'fallback_health_2',
                title: "Mental Health Awareness Programs Expand",
                snippet: "Communities invest in accessible mental health services and support systems.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Mental+Health",
                publishedAt: new Date().toISOString(),
                source: "Health News",
                category: "health"
            }
        ],

        science: [
            {
                id: 'fallback_sci_1',
                title: "Space Mission Discovers New Exoplanets",
                snippet: "Telescope identifies potentially habitable worlds in distant star systems.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Space",
                publishedAt: new Date().toISOString(),
                source: "Science Daily",
                category: "science"
            },
            {
                id: 'fallback_sci_2',
                title: "Particle Physics Experiment Yields Surprising Results",
                snippet: "Researchers detect unexpected phenomena in high-energy collider experiments.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Physics",
                publishedAt: new Date().toISOString(),
                source: "Science Daily",
                category: "science"
            }
        ],

        economy: [
            {
                id: 'fallback_econ_1',
                title: "Central Bank Maintains Interest Rates",
                snippet: "Monetary policy remains steady as inflation shows signs of stabilization.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Economy",
                publishedAt: new Date().toISOString(),
                source: "Economic Times",
                category: "economy"
            },
            {
                id: 'fallback_econ_2',
                title: "GDP Growth Exceeds Expectations",
                snippet: "Economic expansion accelerates driven by consumer spending and investments.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=GDP",
                publishedAt: new Date().toISOString(),
                source: "Economic Times",
                category: "economy"
            }
        ],

        legal: [
            {
                id: 'fallback_legal_1',
                title: "High Court Delivers Landmark Judgment",
                snippet: "Decision sets important precedent for civil rights and constitutional law.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Court",
                publishedAt: new Date().toISOString(),
                source: "Legal News",
                category: "legal"
            },
            {
                id: 'fallback_legal_2',
                title: "New Legislation Addresses Digital Rights",
                snippet: "Laws updated to reflect modern challenges in privacy and data protection.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Law",
                publishedAt: new Date().toISOString(),
                source: "Legal News",
                category: "legal"
            }
        ],

        culture: [
            {
                id: 'fallback_culture_1',
                title: "Film Festival Showcases International Cinema",
                snippet: "Diverse storytelling from around the world celebrated at annual event.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Film+Festival",
                publishedAt: new Date().toISOString(),
                source: "Culture Beat",
                category: "culture"
            },
            {
                id: 'fallback_culture_2',
                title: "Museum Exhibition Explores Ancient Civilizations",
                snippet: "Artifacts and interactive displays bring history to life for visitors.",
                url: "#",
                image: "https://via.placeholder.com/600x400?text=Museum",
                publishedAt: new Date().toISOString(),
                source: "Culture Beat",
                category: "culture"
            }
        ]
    }
};

module.exports = HARDCODED_DATA;