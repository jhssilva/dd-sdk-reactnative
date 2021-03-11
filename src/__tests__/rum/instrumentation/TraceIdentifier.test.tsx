import { genreateTraceId } from '../../../rum/instrumentation/TraceIdentifier'


it('M return an unique identifier W toString', async () => {
    // GIVEN
    const generatedIds = new Set<String>()
    const iterations = 100
    var counter = iterations

    // WHEN
    while (counter-- > 0) {
        generatedIds.add(genreateTraceId())
    }

    // THEN
    expect(generatedIds.size).toBe(iterations)
})

it('M return an 64 bits positive integer W toString', async () => {
    let iterations = 100
    while (iterations-- > 0) {
        // GIVEN
        const id = genreateTraceId()

        // THEN
        expect(id).toMatch(/[1-9]{1,19}/)
        // should be less than the max 64 bits integer
        if (id.length == 19) {
            expect(id < "9223372036854775807").toBeTruthy()
        }
    }

})
