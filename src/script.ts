// Mettez votre ClientId
const clientId = "";
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

const accessToken = localStorage.getItem("access_token");
const expiresAt = Number(localStorage.getItem("expires_at"));

if (accessToken && Date.now() < expiresAt) {
    const profile = await fetchProfile(accessToken);
    populateUI(profile);

    const artists = await fetchFollowedArtists(accessToken);
    displayFollowedArtists(artists);

    initSpotifyIframe();
} else if (localStorage.getItem("refresh_token")) {
    const newAccessToken = await refreshAccessToken();
    const profile = await fetchProfile(newAccessToken);
    populateUI(profile);
    
    const artists = await fetchFollowedArtists(newAccessToken);
    displayFollowedArtists(artists);

    initSpotifyIframe();

} else if (!code) {
    redirectToAuthCodeFlow(clientId);
} else {
    const newAccessToken = await getAccessToken(clientId, code);
    const profile = await fetchProfile(newAccessToken);
    
    populateUI(profile);

    const artists = await fetchFollowedArtists(newAccessToken);
    displayFollowedArtists(artists);

    initSpotifyIframe();
}

async function getToken(): Promise<string> {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Aucun token trouvé. Reconnecte-toi !");
  return token;
}

export async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    // Mettez la redirect uri en deuxième paramètre
    params.append("redirect_uri", "ICI");
    params.append("scope", "user-read-private user-read-email user-follow-read user-follow-modify");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length: number) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}


export async function getAccessToken(clientId: string, code: string): Promise<string> {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    // Re mettez votre redirect URI ici aussi en deuxième paramètre toujours
    params.append("redirect_uri", "ICI");
    params.append("code_verifier", verifier!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token, refresh_token, expires_in } = await result.json();
    
    if (!access_token) {
        throw new Error("Failed to fetch access token");
    }

    localStorage.setItem("access_token", access_token);
    if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token);
    }
    localStorage.setItem("expires_at", Date.now() + expires_in * 1000);

    return access_token;}

async function fetchProfile(token: string): Promise<any> {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

function populateUI(profile: any) {
    document.getElementById("displayName")!.innerText = profile.display_name;
    if (profile.images[0]) {
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        document.getElementById("avatar")!.appendChild(profileImage);
    }
    document.getElementById("id")!.innerText = profile.id;
    document.getElementById("email")!.innerText = profile.email;
    document.getElementById("uri")!.innerText = profile.uri;
    document.getElementById("uri")!.setAttribute("href", profile.external_urls.spotify);
    document.getElementById("url")!.innerText = profile.href;
    document.getElementById("url")!.setAttribute("href", profile.href);
    document.getElementById("imgUrl")!.innerText = profile.images[0]?.url ?? '(no profile image)';
}

export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error("No refresh token available");

  const url = "https://accounts.spotify.com/api/token";

  const payload = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    }),
  };

  const body = await fetch(url, payload);
  const response = await body.json();

  localStorage.setItem('access_token', response.access_token);
  if (response.refresh_token) localStorage.setItem('refresh_token', response.refresh_token);
  localStorage.setItem('expires_at', Date.now() + response.expires_in * 1000);

  return response.access_token;
}


async function fetchFollowedArtists(token: string) {
    const result = await fetch("https://api.spotify.com/v1/me/following?type=artist&limit=10", {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const data = await result.json();
    return data.artists.items;
}


async function displayFollowedArtists(artists: any[]) {
  const container = document.querySelector("section > div")!;
  const token = localStorage.getItem("access_token");
  container.innerHTML = "";

  if (!artists || artists.length === 0) {
    container.innerHTML = "<p>Aucun artiste suivi.</p>";
    return;
  }

  artists.forEach((artist, index) => {
    const div = document.createElement("div");
    div.className = "artist-item";

    div.innerHTML = `
      <img class="artist-cover" src="${artist.images?.[0]?.url || artist.images?.[1]?.url || artist.images?.[2]?.url || "https://via.placeholder.com/48"}" alt="${artist.name}" />
      <div class="artist-info">
        <p class="artist-title">${artist.name}</p>
        <a href="https://open.spotify.com/artist/${artist.id}" class="artiste-artist" target="_blank">Voir sur Spotify</a>
      </div>
      <button class="follow-btn">Ne plus suivre</button>
    `;

    const followBtn = div.querySelector(".follow-btn")!;
    followBtn.addEventListener("click", async () => {
      followBtn.textContent = "Suivre";
      const url = `https://api.spotify.com/v1/me/following?type=artist&ids=${artist.id}`;
      await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      div.remove();
    });

    container.appendChild(div);
  });
}



document.querySelector("#search-button")?.addEventListener("click", async (e) => {
  e.preventDefault();

  const query = (document.getElementById("search-input") as HTMLInputElement).value.trim();

  if (query.length < 2) {
    document.querySelector(".searched-result")!.innerHTML = "";
    return;
  }

  const tracks = await searchTracks(query);
  displaySearchedTracks(tracks);
});

async function searchTracks(query: string) {
  try {
    const token = await getToken();

    const result = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!result.ok) throw new Error(`Erreur API : ${result.status}`);

    const data = await result.json();
    return data.tracks?.items || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

function displaySearchedTracks(tracks: any[]) {
  const section = document.querySelector(".searched-result")!;
  section.innerHTML = "";

  if (!tracks.length) {
    section.innerHTML = "<p>Aucun résultat trouvé.</p>";
    return;
  }

  tracks.forEach((track, index) => {
    const div = document.createElement("div");
    div.className = "track-item";

    const durationMs = track.duration_ms;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(0);
    const duration = `${minutes}:${seconds.padStart(2, '0')}`;

    div.innerHTML = `
      <span class="track-number">${index + 1}</span>
      <img class="track-cover" src="${track.album.images?.[0]?.url || track.album.images?.[1]?.url || track.album.images?.[2]?.url || "https://via.placeholder.com/48"}" alt="${track.album.name}" />
      <div class="track-info">
        <div class="track-title">${track.name}</div>
        <div class="track-artist">${track.artists.map((a: any) => a.name).join(", ")}</div>
      </div>
      <div class="track-album">${track.album.name}</div>
      <span class="track-duration">${duration}</span>
      <button data-spotify-id="${track.uri}" class="play-btn track">▶</button>
    `;

    section.appendChild(div);
  });
}

document.querySelector("#search-artist-button")?.addEventListener("click", async (e) => {
  e.preventDefault();

  const query = (document.getElementById("search-artist-input") as HTMLInputElement).value.trim();

  if (query.length < 2) {
    document.querySelector(".searched-artists-result")!.innerHTML = "";
    return;
  }

  const artists = await searchArtists(query);
  displaySearchedArtists(artists);
});

async function searchArtists(query: string) {
  try {
    const token = await getToken();

    const result = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!result.ok) throw new Error(`Erreur API : ${result.status}`);

    const data = await result.json();
    return data.artists?.items || [];
  } catch (err) {
    console.error(err); 
    return [];
  }
}

async function displaySearchedArtists(artists: any[]) {
  const section = document.querySelector(".searched-artists-result")!;
  const token = await getToken();
  section.innerHTML = "";

  if (!artists.length) {
    section.innerHTML = "<p>Aucun résultat trouvé.</p>";
    return;
  }

  const followedArtists = await fetchFollowedArtists(token!);
  const followedArtistIds = followedArtists.map((a: any) => a.id);

  artists.forEach((artist, index) => {
    const div = document.createElement("div");
    div.className = "artist-item";

    let isFollowed = followedArtistIds.includes(artist.id);

    div.innerHTML = `
      <span class="artist-number">${index + 1}</span>
      <img class="artist-cover" src="${
        artist.images?.[0]?.url ||
        artist.images?.[1]?.url ||
        artist.images?.[2]?.url ||
        "https://via.placeholder.com/48"
      }" alt="${artist.name}" />
      <div class="artist-info">
        <p class="artist-title">${artist.name}</p>
        <a href="https://open.spotify.com/artist/${artist.id}" class="artiste-artist" target="_blank">Voir sur Spotify</a>
      </div>
      <button class="follow-btn">${isFollowed ? "Ne plus suivre" : "Suivre"}</button>
    `;

    const followBtn = div.querySelector(".follow-btn")!;

    followBtn.addEventListener("click", async () => {
      const url = `https://api.spotify.com/v1/me/following?type=artist&ids=${artist.id}`;

      try {
        await fetch(url, {
          method: isFollowed ? "DELETE" : "PUT",
          headers: { Authorization: `Bearer ${token}` },
        });

        isFollowed = !isFollowed;

        followBtn.textContent = isFollowed ? "Ne plus suivre" : "Suivre";

        followBtn.classList.add("btn-updated");
        setTimeout(() => followBtn.classList.remove("btn-updated"), 300);
      } catch (error) {
        console.error("Erreur lors du suivi / désabonnement :", error);
      }
    });

    section.appendChild(div);
  });
}


function initSpotifyIframe() {
  window.onSpotifyIframeApiReady = (IFrameAPI) => {
    const element = document.getElementById('embed-iframe');
    const options = {
      uri: 'spotify:track:4Cv6ongCvJy9JfSkWVnb5D' // un truc par défaut
    };
    const callback = (EmbedController) => {
      // Délégation d'événement
      document.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains("track")) {
          const uri = target.dataset.spotifyId;
          if (uri) {
            EmbedController.loadUri(uri);
          }
        }
      });
    };
    IFrameAPI.createController(element, options, callback);
  };
}
