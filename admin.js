const input = document.getElementById('fileInput');
const btn = document.getElementById('add');
const gallery = document.getElementById('adminGallery');

let works = JSON.parse(localStorage.getItem('works') || '[]');

function render() {
  gallery.innerHTML = '';
  works.forEach((w, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.draggable = true;
    div.dataset.index = i;

    div.innerHTML = w.type === 'video'
      ? `<video src="${w.src}" muted loop></video>`
      : `<img src="${w.src}" />`;

    div.ondragstart = e => e.dataTransfer.setData('i', i);
    div.ondragover = e => e.preventDefault();
    div.ondrop = e => {
      const from = e.dataTransfer.getData('i');
      [works[from], works[i]] = [works[i], works[from]];
      save();
    };

    gallery.appendChild(div);
  });
}

function save() {
  localStorage.setItem('works', JSON.stringify(works));
  render();
}

btn.onclick = () => {
  [...input.files].forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      works.unshift({
        type: file.type.startsWith('video') ? 'video' : 'image',
        src: e.target.result
      });
      save();
    };
    reader.readAsDataURL(file);
  });
};

render();
