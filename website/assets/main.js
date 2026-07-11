const navToggle = document.querySelector('.nav-toggle')
const nav = document.querySelector('#site-nav')

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true'
    navToggle.setAttribute('aria-expanded', String(!expanded))
    nav.classList.toggle('is-open', !expanded)
  })
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('href')
    if (!targetId || targetId === '#') return
    const target = document.querySelector(targetId)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    nav?.classList.remove('is-open')
    navToggle?.setAttribute('aria-expanded', 'false')
  })
})
