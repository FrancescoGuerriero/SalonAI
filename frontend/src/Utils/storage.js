const TOKEN_KEY = "salonai_token";
const USER_KEY = "salonai_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (!token) {
    removeToken();
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getUser() {
  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    removeUser();
    return null;
  }
}

function setUser(user) {
  if (!user) {
    removeUser();
    return;
  }

  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem(USER_KEY);
}

function clear() {
  removeToken();
  removeUser();
}

export const storage = {
  getToken,
  setToken,
  removeToken,
  getUser,
  setUser,
  removeUser,
  clear
};