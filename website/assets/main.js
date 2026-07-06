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

const contactForm = document.querySelector('.contact-form')
const formResult = document.querySelector('.form-result')

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault()
  if (formResult) {
    formResult.textContent = '已记录你的咨询意向。正式上线时这里会接入微信或表单服务。'
  }
})