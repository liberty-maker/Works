const gallery = document.getElementById('gallery');
const items = JSON.parse(localStorage.getItem('works') || '[]');

items.forEach(item => {
  const div = document.createElement('div');
  div.className = 'item';

  if (item.type === 'video') {
    div.innerHTML = `<video src="${item.src}" autoplay muted loop></video>`;
  } else {
    div.innerHTML = `<img src="${item.src}" />`;
  }

  gallery.appendChild(div);
});
