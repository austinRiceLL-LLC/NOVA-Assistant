"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONNECTOR_CATALOG } from "@/lib/nova/connectors";
import { NOVA_CORE_VERSION } from "@/lib/nova/domain";

type Category = "All" | "Priority" | "Work" | "Interviews" | "Opportunities" | "Events";

type Mail = {
  id: number;
  sender: string;
  initials: string;
  subject: string;
  preview: string;
  summary: string;
  category: Exclude<Category, "All" | "Priority">;
  time: string;
  account: string;
  priority: boolean;
  unread: boolean;
  color: string;
  action: string;
};

const seedMail: Mail[] = [
  {
    id: 1,
    sender: "Priya Shah",
    initials: "PS",
    subject: "Final interview — Product Strategy",
    preview: "We'd love to invite you to the final conversation with our VP of Product...",
    summary: "Final-round interview confirmed for tomorrow at 2:00 PM. The panel includes the VP of Product and two team leads. A portfolio walkthrough is expected.",
    category: "Interviews",
    time: "8:42 AM",
    account: "work@outlook.com",
    priority: true,
    unread: true,
    color: "#d8f26a",
    action: "Accept interview",
  },
  {
    id: 2,
    sender: "Marcus Lee",
    initials: "ML",
    subject: "Q3 planning notes + decisions",
    preview: "Quick recap from yesterday. We landed on the three core priorities for Q3...",
    summary: "The Q3 plan is approved around retention, mobile onboarding, and enterprise reporting. You own the first draft of the measurement plan, due Friday.",
    category: "Work",
    time: "8:16 AM",
    account: "work@outlook.com",
    priority: true,
    unread: true,
    color: "#ffd7aa",
    action: "Add task",
  },
  {
    id: 3,
    sender: "Horizon Ventures",
    initials: "HV",
    subject: "Invitation: Future of AI summit",
    preview: "Join a small group of operators and researchers in New York this September...",
    summary: "Invitation to a one-day AI leadership summit in New York on September 18. Registration is complimentary and closes next Tuesday.",
    category: "Events",
    time: "Yesterday",
    account: "personal@gmail.com",
    priority: false,
    unread: true,
    color: "#b9ccff",
    action: "View event",
  },
  {
    id: 4,
    sender: "Elena at Northstar",
    initials: "EN",
    subject: "A role that might fit your background",
    preview: "Your experience building cross-functional programs caught my attention...",
    summary: "A recruiter is proposing a Director of Operations role at a Series C company. The salary range is $175–210K plus equity. They asked for a 20-minute introductory call.",
    category: "Opportunities",
    time: "Yesterday",
    account: "personal@gmail.com",
    priority: false,
    unread: false,
    color: "#ffc7df",
    action: "Draft reply",
  },
  {
    id: 5,
    sender: "Jordan Kim",
    initials: "JK",
    subject: "Client launch checklist",
    preview: "Attaching the revised checklist. Two items still need your approval before...",
    summary: "The launch remains on track for Monday. Two items need your approval: final analytics events and the support escalation workflow.",
    category: "Work",
    time: "Tue",
    account: "work@outlook.com",
    priority: false,
    unread: false,
    color: "#e6d6ff",
    action: "Review checklist",
  },
  {
    id: 6,
    sender: "Maya Chen",
    initials: "MC",
    subject: "Coffee while you're in Boston?",
    preview: "Saw your conference post—I'll be nearby and would love to catch up...",
    summary: "Maya will also attend the Boston conference and suggested coffee Thursday afternoon. No specific time has been chosen.",
    category: "Events",
    time: "Mon",
    account: "personal@gmail.com",
    priority: false,
    unread: false,
    color: "#a9e3d5",
    action: "Find a time",
  },
];

const filters: Category[] = ["All", "Priority", "Work", "Interviews", "Opportunities", "Events"];

type NewsStory = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

type ContextData = {
  location: {
    city: string;
    region: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
  };
  timezone: string;
  weather: {
    temperature: number;
    feelsLike: number;
    condition: string;
    code: number;
    windSpeed: number;
    precipitation: number;
    isDay: boolean;
    daily: Array<{
      date: string;
      code: number;
      condition: string;
      high: number;
      low: number;
      rainChance: number;
    }>;
  };
  news: { local: NewsStory[]; national: NewsStory[] };
  updatedAt: string;
};

type NewsApiItem = Record<string, unknown>;

type WeatherApiResponse = {
  timezone: string;
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

type PlaceApiResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
};

type NetworkLocationResponse = Record<string, unknown>;

type LocationState = "locating" | "live" | "denied" | "unavailable";
type LocationSource = "precise" | "network";

function distanceInMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadius = 3958.8;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const start = toRadians(a.latitude);
  const end = toRadians(b.latitude);
  const h = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(start) * Math.cos(end) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function weatherMark(code?: number) {
  if (code === undefined) return "--";
  if (code === 0) return "SUN";
  if (code <= 3) return "MIX";
  if (code <= 48) return "FOG";
  if (code <= 67 || (code >= 80 && code <= 82)) return "RAIN";
  if (code <= 77 || (code >= 85 && code <= 86)) return "SNOW";
  return "STORM";
}

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

function normalizeNewsItem(item: NewsApiItem): NewsStory {
  const titleParts = String(item.title || "").split(" - ");
  const source = titleParts.length > 1 ? titleParts.pop() || "News" : String(item.author || "News");
  return {
    title: titleParts.join(" - ") || String(item.title || "Untitled story"),
    url: String(item.link || "#"),
    source,
    publishedAt: String(item.pubDate || new Date().toISOString()),
  };
}

function storyAge(value: string) {
  const published = new Date(value).getTime();
  const hours = Math.max(0, Math.round((Date.now() - published) / 3_600_000));
  if (!Number.isFinite(hours)) return "Recent";
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function NewsColumn({ title, subtitle, stories, loading }: { title: string; subtitle: string; stories: NewsStory[]; loading: boolean }) {
  return <article className="news-column">
    <div className="news-column-head"><div><span>{title}</span><small>{subtitle}</small></div><b>Live feed</b></div>
    {loading && !stories.length ? <div className="news-loading"><i /><i /><i /></div> : stories.length ? <div className="story-list">
      {stories.map((story, index) => <a key={`${story.url}-${index}`} href={story.url} target="_blank" rel="noreferrer">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div><h3>{story.title}</h3><p>{story.source} · {storyAge(story.publishedAt)}</p></div>
        <b>↗</b>
      </a>)}
    </div> : <div className="news-empty"><b>No headlines loaded</b><span>Enable location or refresh the feed.</span></div>}
  </article>;
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Home");
  const [filter, setFilter] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [mail, setMail] = useState(seedMail);
  const [selectedId, setSelectedId] = useState(1);
  const [command, setCommand] = useState("");
  const [assistantNote, setAssistantNote] = useState("I’m connecting to this device for live time, weather, location, and regional news.");
  const [toast, setToast] = useState("");
  const [listening, setListening] = useState(false);
  const [now, setNow] = useState(() => new Date("2000-01-01T12:00:00.000Z"));
  const [contextData, setContextData] = useState<ContextData | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("locating");
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [contextError, setContextError] = useState("");
  const lastCoordinates = useRef<{ latitude: number; longitude: number } | null>(null);
  const preciseLocationActive = useRef(false);
  const networkLocationInFlight = useRef(false);

  const loadContext = useCallback(async (latitude: number, longitude: number, force = false, source: LocationSource = "precise") => {
    if (source === "network" && preciseLocationActive.current) return;
    const nextCoordinates = { latitude, longitude };
    if (!force && lastCoordinates.current && distanceInMiles(lastCoordinates.current, nextCoordinates) < 8) return;
    setLocationState("locating");
    setContextError("");

    try {
      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.search = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        current: "temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        temperature_unit: "fahrenheit",
        wind_speed_unit: "mph",
        precipitation_unit: "inch",
        timezone: "auto",
        forecast_days: "3",
      }).toString();

      const placeUrl = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
      placeUrl.search = new URLSearchParams({ latitude: latitude.toString(), longitude: longitude.toString(), localityLanguage: "en" }).toString();

      const [weatherResponse, placeResponse] = await Promise.all([fetch(weatherUrl), fetch(placeUrl)]);
      if (!weatherResponse.ok || !placeResponse.ok) throw new Error("A regional data provider is temporarily unavailable.");
      const weather = await weatherResponse.json() as WeatherApiResponse;
      const place = await placeResponse.json() as PlaceApiResponse;
      const city = place.city || place.locality || place.principalSubdivision || "Your area";
      const region = place.principalSubdivision || "Current region";
      const country = place.countryName || "United States";
      const countryCode = String(place.countryCode || "US").toUpperCase();
      const language = countryCode === "US" ? "en-US" : "en";
      const edition = countryCode === "US" ? "US:en" : `${countryCode}:en`;
      const localFeed = `https://news.google.com/rss/search?q=${encodeURIComponent(`(${city} OR ${region}) when:2d`)}&hl=${language}&gl=${countryCode}&ceid=${edition}`;
      const nationalFeed = `https://news.google.com/rss?hl=${language}&gl=${countryCode}&ceid=${edition}`;
      const toNewsApi = (feed: string) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`;
      const [localNewsResult, nationalNewsResult] = await Promise.allSettled([fetch(toNewsApi(localFeed)), fetch(toNewsApi(nationalFeed))]);
      const readNews = async (result: PromiseSettledResult<Response>) => {
        if (result.status !== "fulfilled" || !result.value.ok) return [];
        const payload = await result.value.json() as { items?: NewsApiItem[] };
        return (payload.items || []).slice(0, 5).map(normalizeNewsItem);
      };
      const [localNews, nationalNews] = await Promise.all([readNews(localNewsResult), readNews(nationalNewsResult)]);

      const data: ContextData = {
        location: { city, region, country, countryCode, latitude, longitude },
        timezone: weather.timezone,
        weather: {
          temperature: Math.round(weather.current.temperature_2m),
          feelsLike: Math.round(weather.current.apparent_temperature),
          condition: weatherLabel(weather.current.weather_code),
          code: weather.current.weather_code,
          windSpeed: Math.round(weather.current.wind_speed_10m),
          precipitation: weather.current.precipitation,
          isDay: Boolean(weather.current.is_day),
          daily: weather.daily.time.map((date: string, index: number) => ({
            date,
            code: weather.daily.weather_code[index],
            condition: weatherLabel(weather.daily.weather_code[index]),
            high: Math.round(weather.daily.temperature_2m_max[index]),
            low: Math.round(weather.daily.temperature_2m_min[index]),
            rainChance: weather.daily.precipitation_probability_max[index],
          })),
        },
        news: { local: localNews, national: nationalNews },
        updatedAt: new Date().toISOString(),
      };

      if (source === "network" && preciseLocationActive.current) return;
      lastCoordinates.current = nextCoordinates;
      setContextData(data);
      setLocationSource(source);
      setLocationState("live");
      setAssistantNote(source === "precise"
        ? `Live in ${data.location.city}: ${data.weather.temperature}° and ${data.weather.condition.toLowerCase()}. Atlas will recalibrate when this device moves.`
        : `Live near ${data.location.city}: ${data.weather.temperature}° and ${data.weather.condition.toLowerCase()}. This is an approximate network location; precise browser access is optional.`);
      window.localStorage.setItem("nova-last-location", JSON.stringify({ ...nextCoordinates, source }));
    } catch (error) {
      if (source === "network" && preciseLocationActive.current) return;
      setLocationState("unavailable");
      setContextError(error instanceof Error ? error.message : "Live context could not be loaded.");
    }
  }, []);

  const loadNetworkLocation = useCallback(async (force = true) => {
    if (networkLocationInFlight.current || preciseLocationActive.current) return;
    networkLocationInFlight.current = true;
    setLocationState("locating");
    setContextError("");

    try {
      const providers = [
        {
          url: "https://ipwho.is/",
          read: (data: NetworkLocationResponse) => ({ latitude: Number(data.latitude), longitude: Number(data.longitude), valid: data.success !== false }),
        },
        {
          url: "https://ipapi.co/json/",
          read: (data: NetworkLocationResponse) => ({ latitude: Number(data.latitude), longitude: Number(data.longitude), valid: !data.error }),
        },
      ];
      let coordinates: { latitude: number; longitude: number } | null = null;

      for (const provider of providers) {
        try {
          const response = await fetch(provider.url, { cache: "no-store" });
          if (!response.ok) continue;
          const candidate = provider.read(await response.json() as NetworkLocationResponse);
          if (candidate.valid && Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude)) {
            coordinates = { latitude: candidate.latitude, longitude: candidate.longitude };
            break;
          }
        } catch {
          // Try the next privacy-conscious IP location provider.
        }
      }

      if (!coordinates) throw new Error("Automatic location is temporarily unavailable. Check your connection and try again.");
      await loadContext(coordinates.latitude, coordinates.longitude, force, "network");
    } catch (error) {
      if (!preciseLocationActive.current) {
        setLocationState("unavailable");
        setContextError(error instanceof Error ? error.message : "Automatic location could not be loaded.");
      }
    } finally {
      networkLocationInFlight.current = false;
    }
  }, [loadContext]);

  useEffect(() => {
    const scheduledTasks: number[] = [];
    const schedule = (task: () => void) => scheduledTasks.push(window.setTimeout(task, 0));
    schedule(() => setNow(new Date()));
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const stored = window.localStorage.getItem("nova-last-location");
    let hasStoredLocation = false;
    if (stored) {
      try {
        const coordinates = JSON.parse(stored) as { latitude: number; longitude: number; source?: LocationSource };
        if (Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude)) {
          hasStoredLocation = true;
          schedule(() => void loadContext(coordinates.latitude, coordinates.longitude, true, coordinates.source === "network" ? "network" : "precise"));
        }
      } catch {
        window.localStorage.removeItem("nova-last-location");
      }
    }

    if (!hasStoredLocation) schedule(() => void loadNetworkLocation(true));

    if (!("geolocation" in navigator)) {
      schedule(() => void loadNetworkLocation(true));
      const networkRefresh = window.setInterval(() => loadNetworkLocation(false), 900_000);
      return () => {
        scheduledTasks.forEach((task) => window.clearTimeout(task));
        window.clearInterval(clock);
        window.clearInterval(networkRefresh);
      };
    }

    const watch = navigator.geolocation.watchPosition(
      (position) => {
        preciseLocationActive.current = true;
        loadContext(position.coords.latitude, position.coords.longitude, false, "precise");
      },
      () => {
        preciseLocationActive.current = false;
        loadNetworkLocation(true);
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 20_000 },
    );
    const networkRefresh = window.setInterval(() => loadNetworkLocation(false), 900_000);

    return () => {
      scheduledTasks.forEach((task) => window.clearTimeout(task));
      window.clearInterval(clock);
      window.clearInterval(networkRefresh);
      navigator.geolocation.clearWatch(watch);
    };
  }, [loadContext, loadNetworkLocation]);

  const recalibrate = () => {
    preciseLocationActive.current = false;
    setLocationState("locating");
    loadNetworkLocation(true);
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        preciseLocationActive.current = true;
        loadContext(position.coords.latitude, position.coords.longitude, true, "precise");
      },
      () => {
        preciseLocationActive.current = false;
        loadNetworkLocation(true);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  };

  const timeZone = contextData?.timezone;
  const localTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone }).format(now);
  const localDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone }).format(now);
  const greetingHour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";

  const visibleMail = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return mail.filter((item) => {
      const matchesFilter =
        filter === "All" || (filter === "Priority" ? item.priority : item.category === filter);
      const matchesQuery =
        !normalized ||
        `${item.sender} ${item.subject} ${item.preview} ${item.category}`.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, mail]);

  const selected = mail.find((item) => item.id === selectedId) ?? visibleMail[0] ?? mail[0];

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function handleCommand(event: FormEvent) {
    event.preventDefault();
    const request = command.trim();
    if (!request) return;
    const lower = request.toLowerCase();
    if (lower.includes("weather") || lower.includes("temperature")) {
      setAssistantNote(contextData ? `It’s ${contextData.weather.temperature}° in ${contextData.location.city}, feels like ${contextData.weather.feelsLike}°, with ${contextData.weather.condition.toLowerCase()}.` : "Enable this device’s location so I can calculate live weather.");
    } else if (lower.includes("news") || lower.includes("headline")) {
      document.getElementById("news")?.scrollIntoView({ behavior: "smooth" });
      setAssistantNote(contextData ? `I loaded live local headlines for ${contextData.location.city} and national coverage for ${contextData.location.country}.` : "Enable location so I can calibrate your local and national news feeds.");
    } else if (lower.includes("time") || lower.includes("location") || lower.includes("where am")) {
      setAssistantNote(contextData ? `This device is calibrated to ${contextData.location.city}, ${contextData.location.region}. Local time is ${localTime}.` : `This device reports ${localTime}. Enable location to identify the current region.`);
    } else if (lower.includes("calendar") || lower.includes("schedule") || lower.includes("plan")) {
      setAssistantNote("The planner and conflict engine are ready, but no calendar is authorized. Atlas will not invent events; connect Google or Outlook Calendar when integration testing begins.");
    } else if (lower.includes("connect") || lower.includes("architecture") || lower.includes("core")) {
      document.getElementById("core")?.scrollIntoView({ behavior: "smooth" });
      setAssistantNote(`Atlas Core ${NOVA_CORE_VERSION} is ready for connector testing: consent controls, event normalization, alerts, planning, memory, and audit boundaries are in place.`);
    } else if (lower.includes("deadline") || lower.includes("remind") || lower.includes("alert")) {
      document.getElementById("core")?.scrollIntoView({ behavior: "smooth" });
      setAssistantNote("The deadline and alert engine is ready. It will begin reporting real obligations only after an authorized source supplies them.");
    } else if (lower.includes("interview")) {
      setFilter("Interviews");
      setSelectedId(1);
      setAssistantNote("The preview contains one demonstration interview email. Connect a live inbox before Atlas treats any interview or deadline as real.");
    } else if (lower.includes("opportunit") || lower.includes("job")) {
      document.getElementById("core")?.scrollIntoView({ behavior: "smooth" });
      setAssistantNote("The job-matching core is ready. Atlas needs an approved resume profile and a live job source before it reports real opportunities.");
    } else if (lower.includes("priority") || lower.includes("urgent")) {
      setFilter("Priority");
      setAssistantNote("Two demonstration messages are marked priority. A connected inbox is required before Atlas reports real urgent mail.");
    } else {
      setAssistantNote(`I’m ready to help with “${request}.” Device context is live; account data will appear only after you connect the relevant app.`);
    }
    setCommand("");
  }

  function completeMessage() {
    setMail((items) => items.map((item) => item.id === selected.id ? { ...item, priority: false, unread: false } : item));
    flash("Marked as handled");
  }

  function archiveMessage() {
    const next = mail.filter((item) => item.id !== selected.id);
    setMail(next);
    setSelectedId(next[0]?.id ?? 0);
    flash("Message archived");
  }

  return (
    <main className="shell">
      <aside className="rail" aria-label="Main navigation">
        <button className="brand-mark" aria-label="Atlas home" onClick={() => setActiveNav("Home")}>A</button>
        <nav className="rail-nav">
          {[
            ["Home", "⌂"],
            ["Inbox", "✉"],
            ["Calendar", "◫"],
            ["Core", "✦"],
          ].map(([name, icon]) => (
            <button
              key={name}
              className={activeNav === name ? "rail-button active" : "rail-button"}
              onClick={() => {
                setActiveNav(name);
                if (name === "Inbox") document.getElementById("inbox")?.scrollIntoView({ behavior: "smooth" });
                else if (name === "Calendar" || name === "Core") document.getElementById("core")?.scrollIntoView({ behavior: "smooth" });
                else window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label={name}
              title={name}
            >
              <span>{icon}</span>
              <small>{name}</small>
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button className="rail-button" onClick={() => document.getElementById("connections")?.scrollIntoView({ behavior: "smooth" })} aria-label="Settings" title="Settings">
            <span>⚙</span><small>Settings</small>
          </button>
          <button className="avatar" aria-label="Your profile">SO</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="wordmark">Atlas <span>work intelligence</span></div>
          <div className={locationState === "live" ? "system-status" : "system-status pending"}><i /> {locationState === "live" ? `${locationSource === "network" ? "Approximate" : "Precise"} context live` : locationState === "locating" ? "Calibrating device" : "Location unavailable"} <span>0 work accounts authorized</span></div>
          <a className="connect-button" href="/workspace">Open workspace →</a>
        </header>

        <div className="content">
          <section className="briefing" aria-labelledby="briefing-title">
            <div className="brief-copy">
              <div className="eyebrow">{localDate} · {localTime} {timeZone ? `· ${timeZone.replaceAll("_", " ")}` : "· Device time"}</div>
              <h1 id="briefing-title">{greeting},<br />Austin.</h1>
              <p>{assistantNote}</p>
              <div className="brief-actions">
                <button className="primary-button" onClick={() => document.getElementById("news")?.scrollIntoView({ behavior: "smooth" })}>Read live briefing <span>→</span></button>
                <button className={listening ? "voice-button listening" : "voice-button"} onClick={() => { setListening((value) => !value); flash(listening ? "Voice mode paused" : "Voice mode listening"); }}>
                  <b>◉</b> {listening ? "Listening…" : "Talk to Atlas"}
                </button>
              </div>
            </div>

            <div className="day-card live-context-card">
              <div className="day-card-head">
                <div><span>{contextData ? contextData.location.city : "Your location"}</span><strong>{contextData ? `${contextData.location.region} · ${locationSource === "network" ? "approximate" : "precise"}` : locationState === "locating" ? "finding this device" : "automatic lookup unavailable"}</strong></div>
                <button onClick={recalibrate}>Recalibrate ↻</button>
              </div>

              {contextData ? <>
                <div className="weather-now">
                  <div className={`weather-mark weather-${contextData.weather.code}`}><span>{weatherMark(contextData.weather.code)}</span></div>
                  <div><strong>{contextData.weather.temperature}°</strong><span>{contextData.weather.condition}</span><small>Feels like {contextData.weather.feelsLike}° · Wind {contextData.weather.windSpeed} mph</small></div>
                </div>
                <div className="forecast-row">
                  {contextData.weather.daily.map((day, index) => <div key={day.date}>
                    <span>{index === 0 ? "Today" : new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))}</span>
                    <b>{weatherMark(day.code)}</b>
                    <strong>{day.high}° <em>{day.low}°</em></strong>
                    <small>{day.rainChance}% rain</small>
                  </div>)}
                </div>
                <div className="day-footer"><span><i /> {locationSource === "network" ? "Approximate network location · refreshes automatically" : "Precise location · recalibrates after an 8-mile move"}</span><span>Updated {storyAge(contextData.updatedAt)}</span></div>
              </> : <div className="location-empty">
                <div className="location-pulse"><i /><i /><i /></div>
                <h3>{locationState === "locating" ? "Calibrating this device" : "Automatic location is unavailable"}</h3>
                <p>{contextError || "Atlas can calculate local time, weather, and news from an approximate network location without a browser permission prompt."}</p>
                {locationState !== "locating" && <button className="location-button" onClick={recalibrate}>Try automatic location</button>}
              </div>}
            </div>
          </section>

          <section className="signal-row" aria-label="Daily overview">
            <article><span>Local time</span><strong>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone }).format(now)}</strong><small>{timeZone?.replaceAll("_", " ") || "Device timezone"}</small></article>
            <article><span>Current weather</span><strong>{contextData ? `${contextData.weather.temperature}°` : "--"}</strong><small>{contextData?.weather.condition || "Waiting for location"}</small></article>
            <article><span>Geographic region</span><strong className="region-value">{contextData?.location.region || "Unknown"}</strong><small>{contextData ? `${contextData.location.city}, ${contextData.location.country} · ${locationSource === "network" ? "approximate" : "precise"}` : "Waiting for automatic calibration"}</small></article>
            <article className="focus-signal"><span>Planner guardrail</span><p>No calendar is connected, so Atlas will not invent events or deadlines.</p><button onClick={() => document.getElementById("core")?.scrollIntoView({ behavior: "smooth" })}>Review the core →</button></article>
          </section>

          <section id="core" className="core-section" aria-labelledby="core-title">
            <div className="core-heading">
              <div><span className="eyebrow">Internal architecture · version {NOVA_CORE_VERSION}</span><h2 id="core-title">A private workspace for connected knowledge.</h2></div>
              <p>Atlas stores user-scoped information in its own durable data layer. Composio can handle OAuth and provider access without owning Atlas’s data model, summaries, or brand.</p>
            </div>

            <div className="core-principles">
              <article><span>01 · Observe</span><h3>Read only by default</h3><p>Every account starts with the smallest approved scope. Disconnected sources contribute nothing.</p><b>Consent policy ready</b></article>
              <article><span>02 · Understand</span><h3>One event language</h3><p>Email, calendars, jobs, files, markets, and messages normalize into the same auditable event stream.</p><b>Normalizer ready</b></article>
              <article><span>03 · Plan</span><h3>Deadlines without fiction</h3><p>Deterministic urgency rules, schedule-conflict detection, and daily briefings operate only on sourced records.</p><b>Alert engine ready</b></article>
              <article><span>04 · Protect</span><h3>Approval before action</h3><p>Drafting and execution are separated. Sending mail or changing a calendar always requires explicit approval.</p><b>Action gate ready</b></article>
            </div>

            <div className="core-pipeline" aria-label="Atlas processing pipeline">
              <span>Authorized source</span><i>→</i><span>Incremental sync</span><i>→</i><span>Privacy filter</span><i>→</i><span>Event store</span><i>→</i><span>Alerts + RAG</span><i>→</i><span>Approval gate</span>
            </div>

            <div className="connector-foundation">
              <div className="connector-foundation-head"><div><span className="eyebrow">Connector broker</span><h3>Accounts and quick capture</h3></div><p>{CONNECTOR_CATALOG.length} defined adapters · permanent notes · cached summaries</p></div>
              <div className="connector-cards">
                {CONNECTOR_CATALOG.map((connector) => <article key={connector.provider}>
                  <div><i>{connector.name.slice(0, 1)}</i><span>{connector.category}</span></div>
                  <h4>{connector.name}</h4>
                  <p>{connector.description}</p>
                  <footer><b className={connector.provider === "device" ? "ready" : "waiting"}>{connector.provider === "device" ? "Live" : "Account required"}</b><span>{connector.capabilities.length} capabilities</span></footer>
                </article>)}
              </div>
            </div>

            <div className="core-privacy"><span>Zero silent actions</span><p>Connected content remains user-scoped. Unchanged records reuse their saved summaries, and every external write still requires approval.</p><a href="/workspace">Open your private workspace →</a></div>
          </section>

          <section id="news" className="news-section" aria-labelledby="news-title">
            <div className="section-heading news-heading">
              <div><span className="eyebrow">Live regional intelligence</span><h2 id="news-title">News around you</h2></div>
              <div className="news-location"><i /> {contextData ? `${contextData.location.city}, ${contextData.location.region}` : "Waiting for device location"}<button onClick={recalibrate}>Refresh</button></div>
            </div>
            <div className="news-grid">
              <NewsColumn title="Local" subtitle={contextData ? `Reporting near ${contextData.location.city}` : "Location required"} stories={contextData?.news.local || []} loading={locationState === "locating"} />
              <NewsColumn title="National" subtitle={contextData ? `Top stories in ${contextData.location.country}` : "Region required"} stories={contextData?.news.national || []} loading={locationState === "locating"} />
            </div>
            <div className="news-disclaimer">Headlines are live and link to their original publishers. Atlas uses approximate network location when precise browser access is blocked; coordinates are only sent to regional weather, place, and news providers.</div>
          </section>

          <section id="inbox" className="inbox-section" aria-labelledby="inbox-title">
            <div className="section-heading">
              <div><span className="eyebrow">Sample workspace · email connection required</span><h2 id="inbox-title">Priority inbox preview</h2></div>
              <div className="inbox-tools">
                <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search everything" aria-label="Search email" /></label>
                <button onClick={() => flash("No live inbox is connected; demo messages were left unchanged")}>↻ <span>Refresh</span></button>
              </div>
            </div>

            <div className="demo-banner"><span>DEMO DATA</span><p>These messages demonstrate Atlas’s sorting and summaries. Connect Gmail or Outlook before personal messages appear here.</p><button onClick={() => document.getElementById("connections")?.scrollIntoView({ behavior: "smooth" })}>Connect email →</button></div>

            <div className="filter-bar" role="tablist" aria-label="Email categories">
              {filters.map((item) => {
                const count = item === "All" ? mail.length : item === "Priority" ? mail.filter((m) => m.priority).length : mail.filter((m) => m.category === item).length;
                return <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item} <span>{count}</span></button>;
              })}
            </div>

            <div className="inbox-grid">
              <div className="message-list" aria-label="Messages">
                <div className="list-meta"><span>{visibleMail.length} distilled messages</span><span>Sorted by relevance ↓</span></div>
                {visibleMail.length ? visibleMail.map((item) => (
                  <button key={item.id} onClick={() => setSelectedId(item.id)} className={selected?.id === item.id ? "message active" : "message"}>
                    <span className="sender-avatar" style={{ background: item.color }}>{item.initials}</span>
                    <span className="message-main">
                      <span className="message-line"><b>{item.sender}</b><time>{item.time}</time></span>
                      <strong>{item.subject}</strong>
                      <span className="message-preview">{item.preview}</span>
                      <span className="message-tags"><em>{item.category}</em><small>{item.account}</small></span>
                    </span>
                    {item.unread && <i className="unread-dot" aria-label="Unread" />}
                  </button>
                )) : <div className="empty-state"><b>No messages here</b><span>Try another category or search.</span></div>}
              </div>

              {selected && <article className="message-detail">
                <div className="detail-top">
                  <div className="detail-person"><span className="sender-avatar large" style={{ background: selected.color }}>{selected.initials}</span><div><b>{selected.sender}</b><small>{selected.account}</small></div></div>
                  <div className="detail-actions"><button onClick={completeMessage} title="Mark handled">✓</button><button onClick={archiveMessage} title="Archive">⌄</button><button onClick={() => flash("More actions available after connecting your inbox")}>•••</button></div>
                </div>
                <h3>{selected.subject}</h3>
                <div className="summary-box">
                  <div className="summary-label"><span>✦</span> Atlas SUMMARY <small>generated from this thread</small></div>
                  <p>{selected.summary}</p>
                </div>
                <div className="key-points">
                  <span>Suggested next move</span>
                  <p>{selected.action === "Accept interview" ? "Confirm attendance and block 30 minutes today to rehearse the portfolio walkthrough." : selected.action === "Add task" ? "Create a Friday task for the measurement-plan draft and link the planning notes." : `Review this message and choose “${selected.action}” when ready.`}</p>
                </div>
                <div className="email-excerpt">
                  <span>Original message</span>
                  <p>Hi Austin,</p>
                  <p>{selected.preview} I wanted to make sure this reached you and give you time to plan the next step.</p>
                  <p>Best,<br />{selected.sender.split(" ")[0]}</p>
                </div>
                <div className="reply-row">
                  <button className="primary-button" onClick={() => flash(`${selected.action} prepared for your review`)}>{selected.action} <span>→</span></button>
                  <button className="secondary-button" onClick={() => flash("Draft generated — account connection required to send")}>✦ Draft with Atlas</button>
                </div>
              </article>}
            </div>
          </section>

          <footer id="connections" className="connectors">
            <span>Atlas Core {NOVA_CORE_VERSION}</span>
            <div><i className="connected-device">✓</i> This device <b>●</b><i>O</i> Outlook <b>●</b><i>G</i> Google <b>●</b><i>D</i> Drive <b>●</b><i>S</i> Slack</div>
            <a href="/workspace">Open knowledge workspace →</a>
          </footer>
        </div>

        <form className="command-bar" onSubmit={handleCommand}>
          <span className="spark">✦</span>
          <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Ask Atlas anything — try “what’s the weather?”" aria-label="Ask Atlas" />
          <span className="shortcut">⌘ K</span>
          <button type="submit">Send ↑</button>
        </form>
      </section>
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
