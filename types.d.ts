interface RGBColor {
    r: number,
    g: number,
    b: number
}

interface Response {
    env: string
    method: string
    result: {
        mac: string
        r: number
        g: number
        b: number
        c: number
        dimming: number
        rssi: number
        sceneId: number
        src: string
        state: boolean
        w: number
    }
}

module.exports = {
    RGBColor
}